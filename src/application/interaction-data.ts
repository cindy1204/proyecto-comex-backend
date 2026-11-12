import { z } from 'zod';
import type { InteractionData, InteractionType } from '../domain/models/interaction.model.js';

/*
 * Reglas de los formularios de interacción. El frontend aplica las mismas reglas antes de enviar
 * (src/features/interactions/domain y src/features/common/domain); aquí se hacen cumplir.
 * Mantener las dos bases sincronizadas al cambiar cualquiera.
 */

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().max(max);

const MAX_INTEGER_DIGITS = 15;
const MAX_AMOUNT_DECIMALS = 2;
const MAX_RATE_DECIMALS = 6;
const DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/** Monedas ISO 4217 vigentes que son monedas (sin fondos, metales, `XXX` ni monedas retiradas). */
const CURRENCY_CODE_LIST = `
  AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN
  BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS
  GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW
  KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD
  NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD
  SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS
  VED VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL
`;
const CURRENCY_CODES: ReadonlySet<string> = new Set(CURRENCY_CODE_LIST.trim().split(/\s+/));

const isDecimal = (value: string) => DECIMAL_PATTERN.test(value);

function integerDigits(value: string): number {
  const [whole = ''] = value.split('.');
  return whole.replace(/^0+/, '').length;
}

function fractionDigits(value: string): number {
  const [, fraction = ''] = value.split('.');
  return fraction.length;
}

/** Número decimal con punto, sin signo ni punto final; con límites de cifras y, opcionalmente, mayor que cero. */
function decimal(maxFraction: number, { positive = false } = {}) {
  return z
    .string()
    .regex(DECIMAL_PATTERN, { message: 'Use solo dígitos y un punto decimal opcional (p. ej. 1000.50).' })
    .refine(
      (value) =>
        !isDecimal(value) || (integerDigits(value) <= MAX_INTEGER_DIGITS && fractionDigits(value) <= maxFraction),
      { message: `Máximo ${MAX_INTEGER_DIGITS} cifras enteras y ${maxFraction} decimales.` },
    )
    .refine((value) => !positive || !isDecimal(value) || /[1-9]/.test(value), {
      message: 'Debe ser mayor que cero.',
    });
}

const amount = decimal(MAX_AMOUNT_DECIMALS);
const positiveAmount = decimal(MAX_AMOUNT_DECIMALS, { positive: true });
const rate = decimal(MAX_RATE_DECIMALS, { positive: true });

const currencyCode = z
  .string()
  .trim()
  .refine((value) => CURRENCY_CODES.has(value), {
    message: 'Moneda no válida: use un código ISO 4217 vigente (p. ej. USD).',
  });

/** Fecha de hoy en Bogotá (UTC-5 sin horario de verano), como `YYYY-MM-DD`. */
function bogotaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** `z.iso.date()` también rechaza días que no existen (p. ej. 2026-02-30); aquí solo se añade la regla de futuro. */
const tradeDate = z.iso
  .date()
  .refine((value) => value <= bogotaToday(), { message: 'La fecha no puede ser futura (hora de Bogotá).' });

const NIT_CHECK_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
/** El NIT exige el dígito de verificación: `800197268-4`. */
const NIT_PATTERN = /^(\d{6,10})-(\d)$/;
const CITIZEN_ID_PATTERN = /^\d{6,10}$/;
const FOREIGN_ID_PATTERN = /^[A-Za-z0-9]{6,20}$/;
const PASSPORT_PATTERN = /^[A-Za-z0-9]{5,20}$/;
const IDENTIFICATION_MESSAGE = 'La identificación no tiene el formato del tipo elegido.';
const NIT_CHECK_DIGIT_MISSING_MESSAGE = 'El NIT debe escribirse con su dígito de verificación (p. ej. 800197268-4).';

/** Dígito de verificación del NIT (DIAN): pesos desde el dígito de la derecha, módulo 11. */
function nitCheckDigit(nit: string): number {
  let sum = 0;
  for (let index = 0; index < nit.length; index++) {
    const digit = Number(nit[nit.length - 1 - index]);
    sum += digit * (NIT_CHECK_WEIGHTS[index] ?? 0);
  }
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

/** Mensaje de error para la identificación según su tipo, o `null` si es válida. */
function identificationProblem(type: string, value: string): string | null {
  if (type === 'NIT') {
    if (/^\d{6,10}$/.test(value)) return NIT_CHECK_DIGIT_MISSING_MESSAGE;
    const match = NIT_PATTERN.exec(value);
    if (!match) return IDENTIFICATION_MESSAGE;
    const [, nit = '', digit = ''] = match;
    if (Number(digit) !== nitCheckDigit(nit)) return 'El dígito de verificación del NIT no coincide.';
    return null;
  }
  if (type === 'Cédula de ciudadanía') return CITIZEN_ID_PATTERN.test(value) ? null : IDENTIFICATION_MESSAGE;
  if (type === 'Cédula de extranjería') return FOREIGN_ID_PATTERN.test(value) ? null : IDENTIFICATION_MESSAGE;
  if (type === 'Pasaporte') return PASSPORT_PATTERN.test(value) ? null : IDENTIFICATION_MESSAGE;
  return IDENTIFICATION_MESSAGE;
}

interface ParsedDecimal {
  digits: bigint;
  scale: number;
}

function parseDecimal(value: string): ParsedDecimal | null {
  if (!isDecimal(value)) return null;
  const [whole = '', fraction = ''] = value.split('.');
  return { digits: BigInt(whole + fraction), scale: fraction.length };
}

/** Redondeo half-up a centavos, igual que `toCents` del frontend. */
function toCents({ digits, scale }: ParsedDecimal): bigint {
  if (scale <= 2) return digits * BigInt(10) ** BigInt(2 - scale);
  const divisor = BigInt(10) ** BigInt(scale - 2);
  const quotient = digits / divisor;
  return (digits % divisor) * BigInt(2) >= divisor ? quotient + BigInt(1) : quotient;
}

function formatCents(cents: bigint): string {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

/** Tolerancia de un centavo entre el total y valor × tasa (la misma que el frontend). */
const TOTAL_TOLERANCE_CENTS = BigInt(1);

/** Mensaje si el total no coincide con valor × tasa, o `null`. Sin datos válidos no comprueba nada. */
function totalMismatch(amountText: string, rateText: string, totalText: string): string | null {
  const value = parseDecimal(amountText);
  const exchange = parseDecimal(rateText);
  const total = parseDecimal(totalText);
  if (!value || !exchange || !total) return null;
  const expected = toCents({ digits: value.digits * exchange.digits, scale: value.scale + exchange.scale });
  const difference = toCents(total) - expected;
  const absolute = difference < BigInt(0) ? -difference : difference;
  return absolute > TOTAL_TOLERANCE_CENTS
    ? `El total en dólares debe ser ${formatCents(expected)} (valor × tasa).`
    : null;
}

type ExchangeField = 'tipoCambioDolar' | 'tasaCambioDolares';

interface CommonRuleInput {
  fechaTramite: string;
  tipoIdentificacion: string;
  identificacion: string;
  valorMonedaNegociacion: string;
  valorTotalDolares: string;
}

/** Reglas que cruzan campos: identificación según su tipo y total igual a valor × tasa. */
function commonRules(exchangeField: ExchangeField) {
  return (data: CommonRuleInput & Partial<Record<ExchangeField, string>>, ctx: z.RefinementCtx) => {
    const identificationError = identificationProblem(data.tipoIdentificacion, data.identificacion);
    if (identificationError)
      ctx.addIssue({
        code: 'custom',
        message: identificationError,
        path: ['identificacion'],
        input: data.identificacion,
      });

    const exchange = data[exchangeField];
    if (exchange === undefined) return;
    const totalError = totalMismatch(data.valorMonedaNegociacion, exchange, data.valorTotalDolares);
    if (totalError)
      ctx.addIssue({ code: 'custom', message: totalError, path: ['valorTotalDolares'], input: data.valorTotalDolares });
  };
}

const commonFields = {
  fechaTramite: tradeDate,
  tipoIdentificacion: z.enum(['NIT', 'Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte']),
  identificacion: requiredText(40),
  monedaNegociacion: currencyCode,
  valorMonedaNegociacion: positiveAmount,
  valorTotalDolares: positiveAmount,
  observaciones: optionalText(2000).optional().default(''),
  nombreDeclarante: requiredText(250),
};

const importDataSchema = z
  .object({
    ...commonFields,
    nombreImportador: requiredText(250),
    tipoCambioDolar: rate,
    numeroDeclaracionFactura: requiredText(100),
    valorFob: amount,
    beneficiarioExterior: requiredText(250),
    ciudadExterior: requiredText(120),
    paisExterior: requiredText(120),
    numeralOperacion: requiredText(40),
  })
  .strict()
  .superRefine(commonRules('tipoCambioDolar'));

const exportDataSchema = z
  .object({
    ...commonFields,
    nombreExportador: requiredText(250),
    tasaCambioDolares: rate,
    numeroDocumento: requiredText(100),
    valorReintegrado: amount,
    totalValorFob: amount,
    totalGastosExportacion: amount,
    deducciones: amount,
    numeralCambiario: requiredText(40),
    reintegroNetoCalculado: z
      .string()
      .max(32)
      .regex(/^-?\d+(?:\.\d{2})$/)
      .refine((value) => Number.isFinite(Number(value)))
      .optional(),
  })
  .strict()
  .superRefine(commonRules('tasaCambioDolares'));

// Servicios, inversiones y endeudamiento comparten el núcleo de datos mínimos de la
// declaración de cambio. El anexo DCIP-83 no describe campos por familia, así que no se
// inventan campos adicionales: cualquier campo específico exige confirmar la fuente oficial.
const declarationDataSchema = z
  .object({
    ...commonFields,
    nombreTitular: requiredText(250),
    tasaCambioDolares: rate,
    numeralCambiario: requiredText(40),
  })
  .strict()
  .superRefine(commonRules('tasaCambioDolares'));

const DATA_SCHEMAS = {
  'formulario-importaciones': importDataSchema,
  'formulario-exportaciones': exportDataSchema,
  'formulario-servicios': declarationDataSchema,
  'formulario-inversiones': declarationDataSchema,
  'formulario-endeudamiento': declarationDataSchema,
} as const satisfies Record<InteractionType, { parse(data: unknown): unknown }>;

export function parseInteractionData(type: InteractionType, data: unknown): InteractionData {
  return DATA_SCHEMAS[type].parse(data) as InteractionData;
}
