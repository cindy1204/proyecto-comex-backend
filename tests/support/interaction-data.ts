/**
 * Cuerpos `data` válidos para los formularios; los tests los sobrescriben campo a campo.
 * El total cumple total = valor × tasa (1000 × 4000), con la tasa de cada fixture.
 */
const common = {
  fechaTramite: '2026-03-15',
  tipoIdentificacion: 'NIT',
  identificacion: '900123456-8',
  monedaNegociacion: 'USD',
  valorMonedaNegociacion: '1000',
  valorTotalDolares: '4000000',
  nombreDeclarante: 'Ana Pérez',
};

export const importData = (overrides: Record<string, unknown> = {}) => ({
  ...common,
  nombreImportador: 'Importadora SAS',
  tipoCambioDolar: '4000',
  numeroDeclaracionFactura: 'DI-001',
  valorFob: '900',
  beneficiarioExterior: 'Acme Inc',
  ciudadExterior: 'Miami',
  paisExterior: 'Estados Unidos',
  numeralOperacion: '2010',
  ...overrides,
});

export const exportData = (overrides: Record<string, unknown> = {}) => ({
  ...common,
  nombreExportador: 'Exportadora SAS',
  tasaCambioDolares: '4000',
  numeroDocumento: 'DEX-001',
  valorReintegrado: '1000',
  totalValorFob: '1000',
  totalGastosExportacion: '50',
  deducciones: '10',
  numeralCambiario: '1010',
  reintegroNetoCalculado: '1040.00',
  ...overrides,
});

/** Núcleo de datos mínimos compartido por servicios, inversiones y endeudamiento. */
export const declarationData = (overrides: Record<string, unknown> = {}) => ({
  ...common,
  nombreTitular: 'Titular SAS',
  tasaCambioDolares: '4000',
  numeralCambiario: '1601',
  ...overrides,
});
