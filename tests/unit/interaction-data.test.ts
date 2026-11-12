import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { parseInteractionData } from '../../src/application/interaction-data.js';
import type { InteractionType } from '../../src/domain/models/interaction.model.js';
import { declarationData, exportData, importData } from '../support/interaction-data.js';

/** Rutas de los campos con error (`[]` si el cuerpo es válido). */
function failingPaths(type: InteractionType, data: unknown): string[] {
  try {
    parseInteractionData(type, data);
    return [];
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map((issue) => issue.path.join('.'));
    throw error;
  }
}

describe('reglas de los datos del formulario', () => {
  it('acepta los cuerpos válidos de cada familia', () => {
    expect(failingPaths('formulario-importaciones', importData())).toEqual([]);
    expect(failingPaths('formulario-exportaciones', exportData())).toEqual([]);
    expect(failingPaths('formulario-servicios', declarationData())).toEqual([]);
  });

  describe('montos y tasas', () => {
    it.each([
      ['un punto final', { valorFob: '1.' }],
      ['notación exponencial', { valorFob: '2e3' }],
      ['un signo negativo', { valorFob: '-1' }],
      ['más de 2 decimales en un monto', { valorFob: '1.234' }],
      ['más de 15 cifras enteras', { valorFob: '1234567890123456' }],
    ])('rechaza un monto con %s', (_case, overrides) => {
      expect(failingPaths('formulario-importaciones', importData(overrides))).toEqual(['valorFob']);
    });

    it('ignora los ceros a la izquierda al contar cifras enteras', () => {
      expect(failingPaths('formulario-importaciones', importData({ valorFob: '000000000000000900' }))).toEqual([]);
    });

    it('exige montos y tasas mayores que cero', () => {
      expect(
        failingPaths('formulario-importaciones', importData({ valorMonedaNegociacion: '0', valorTotalDolares: '0' })),
      ).toEqual(['valorMonedaNegociacion', 'valorTotalDolares']);
      // Una tasa cero también desajusta el total (4000000 ≠ 0), así que solo se exige que aparezca la tasa.
      expect(failingPaths('formulario-importaciones', importData({ tipoCambioDolar: '0.00' }))).toContain(
        'tipoCambioDolar',
      );
    });

    it('permite cero en valores que no son montos en dólares ni tasas', () => {
      expect(failingPaths('formulario-importaciones', importData({ valorFob: '0' }))).toEqual([]);
      expect(failingPaths('formulario-exportaciones', exportData({ deducciones: '0' }))).toEqual([]);
    });

    it('acepta hasta 6 decimales en una tasa', () => {
      const data = declarationData({ tasaCambioDolares: '4000.123456', valorTotalDolares: '4000123.46' });
      expect(failingPaths('formulario-servicios', data)).toEqual([]);
      expect(failingPaths('formulario-servicios', declarationData({ tasaCambioDolares: '4000.1234567' }))).toContain(
        'tasaCambioDolares',
      );
    });
  });

  describe('moneda y fecha', () => {
    it('solo acepta códigos ISO 4217 vigentes', () => {
      expect(failingPaths('formulario-importaciones', importData({ monedaNegociacion: 'EUR' }))).toEqual([]);
      expect(failingPaths('formulario-importaciones', importData({ monedaNegociacion: 'XYZ' }))).toEqual([
        'monedaNegociacion',
      ]);
      expect(failingPaths('formulario-importaciones', importData({ monedaNegociacion: 'XAU' }))).toEqual([
        'monedaNegociacion',
      ]);
    });

    it('rechaza fechas futuras y fechas que no existen', () => {
      expect(failingPaths('formulario-importaciones', importData({ fechaTramite: '2999-01-01' }))).toEqual([
        'fechaTramite',
      ]);
      expect(failingPaths('formulario-importaciones', importData({ fechaTramite: '2026-02-30' }))).toEqual([
        'fechaTramite',
      ]);
      expect(failingPaths('formulario-importaciones', importData({ fechaTramite: '2025-02-29' }))).toEqual([
        'fechaTramite',
      ]);
      expect(failingPaths('formulario-importaciones', importData({ fechaTramite: '2024-02-29' }))).toEqual([]);
    });
  });

  describe('identificación según el tipo', () => {
    it.each([
      ['NIT con dígito de verificación incorrecto', { tipoIdentificacion: 'NIT', identificacion: '800197268-5' }],
      ['NIT con letras', { tipoIdentificacion: 'NIT', identificacion: 'ABC123456' }],
      ['NIT sin dígito de verificación', { tipoIdentificacion: 'NIT', identificacion: '900123456' }],
      ['NIT con dígito de verificación no numérico', { tipoIdentificacion: 'NIT', identificacion: '900123456-X' }],
      ['cédula de ciudadanía con letras', { tipoIdentificacion: 'Cédula de ciudadanía', identificacion: 'AB123456' }],
      ['pasaporte demasiado corto', { tipoIdentificacion: 'Pasaporte', identificacion: 'AB12' }],
    ])('rechaza %s', (_case, overrides) => {
      expect(failingPaths('formulario-exportaciones', exportData(overrides))).toEqual(['identificacion']);
    });

    it('acepta un NIT solo con su dígito de verificación correcto', () => {
      expect(
        failingPaths(
          'formulario-exportaciones',
          exportData({ tipoIdentificacion: 'NIT', identificacion: '800197268-4' }),
        ),
      ).toEqual([]);
      expect(failingPaths('formulario-exportaciones', exportData({ identificacion: '900123456-8' }))).toEqual([]);
    });
  });

  describe('total = valor × tasa', () => {
    it('rechaza un total que no coincide con valor × tasa', () => {
      expect(failingPaths('formulario-exportaciones', exportData({ valorTotalDolares: '1000' }))).toEqual([
        'valorTotalDolares',
      ]);
    });

    it('tolera una diferencia de un centavo y no más', () => {
      // valor × tasa = 100 × 0.005 = 0.50 exacto.
      const exact = { valorMonedaNegociacion: '100', tasaCambioDolares: '0.005' };
      expect(failingPaths('formulario-servicios', declarationData({ ...exact, valorTotalDolares: '0.49' }))).toEqual(
        [],
      );
      expect(failingPaths('formulario-servicios', declarationData({ ...exact, valorTotalDolares: '0.51' }))).toEqual(
        [],
      );
      expect(failingPaths('formulario-servicios', declarationData({ ...exact, valorTotalDolares: '0.52' }))).toEqual([
        'valorTotalDolares',
      ]);
    });

    it('redondea valor × tasa a centavos con mitad hacia arriba', () => {
      // 1 × 0.005 = 0.005, que redondeado (half-up) es 0.01: el total 0.02 queda dentro de la tolerancia.
      const halfUp = { valorMonedaNegociacion: '1', tasaCambioDolares: '0.005' };
      expect(failingPaths('formulario-servicios', declarationData({ ...halfUp, valorTotalDolares: '0.02' }))).toEqual(
        [],
      );
      expect(failingPaths('formulario-servicios', declarationData({ ...halfUp, valorTotalDolares: '0.03' }))).toEqual([
        'valorTotalDolares',
      ]);
    });

    it('compara el total con la tasa de cada operación (tipoCambioDolar en importaciones)', () => {
      expect(
        failingPaths('formulario-importaciones', importData({ tipoCambioDolar: '2', valorTotalDolares: '2000' })),
      ).toEqual([]);
      expect(
        failingPaths('formulario-importaciones', importData({ tipoCambioDolar: '2', valorTotalDolares: '4000000' })),
      ).toEqual(['valorTotalDolares']);
    });
  });
});
