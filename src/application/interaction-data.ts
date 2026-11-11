import { z } from 'zod';
import type { InteractionData, InteractionType } from '../domain/models/interaction.model.js';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().max(max);
const amount = z
  .string()
  .regex(/^(?:\d+\.?\d*|\.\d+)$/)
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0);

const commonFields = {
  fechaTramite: z.iso.date(),
  tipoIdentificacion: z.enum(['NIT', 'Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte']),
  identificacion: requiredText(40),
  monedaNegociacion: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/),
  valorMonedaNegociacion: amount,
  valorTotalDolares: amount,
  observaciones: optionalText(2000).optional().default(''),
  nombreDeclarante: requiredText(250),
};

const importDataSchema = z
  .object({
    ...commonFields,
    nombreImportador: requiredText(250),
    tipoCambioDolar: amount,
    numeroDeclaracionFactura: requiredText(100),
    valorFob: amount,
    beneficiarioExterior: requiredText(250),
    ciudadExterior: requiredText(120),
    paisExterior: requiredText(120),
    numeralOperacion: requiredText(40),
  })
  .strict();

const exportDataSchema = z
  .object({
    ...commonFields,
    nombreExportador: requiredText(250),
    tasaCambioDolares: amount,
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
  .strict();

export function parseInteractionData(type: InteractionType, data: unknown): InteractionData {
  return type === 'formulario-importaciones' ? importDataSchema.parse(data) : exportDataSchema.parse(data);
}
