import { readFileSync } from 'node:fs';
import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { parseInteractionData } from '../../src/application/interaction-data.js';
import type { InteractionType } from '../../src/domain/models/interaction.model.js';

/** Casos compartidos con el frontend: ver `tests/golden/interaction-validation.json`. */
type Family = 'importaciones' | 'exportaciones' | 'declaracion';

interface GoldenCase {
  name: string;
  family: Family;
  overrides: Record<string, string>;
  expectedFields: string[];
}

interface Golden {
  bases: Record<Family, Record<string, string>>;
  cases: GoldenCase[];
}

const TYPE_BY_FAMILY: Record<Family, InteractionType> = {
  importaciones: 'formulario-importaciones',
  exportaciones: 'formulario-exportaciones',
  declaracion: 'formulario-servicios',
};

const golden: Golden = JSON.parse(
  readFileSync(new URL('../golden/interaction-validation.json', import.meta.url), 'utf8'),
);

/** Campos con error, únicos y ordenados (`[]` si el cuerpo es válido). */
function failingFields(type: InteractionType, data: unknown): string[] {
  try {
    parseInteractionData(type, data);
    return [];
  } catch (error) {
    if (error instanceof ZodError) {
      return [...new Set(error.issues.map((issue) => issue.path.join('.')))].sort();
    }
    throw error;
  }
}

describe('casos dorados de validación (compartidos con el frontend)', () => {
  it.each(golden.cases)('$name', ({ family, overrides, expectedFields }) => {
    const body = { ...golden.bases[family], ...overrides };
    expect(failingFields(TYPE_BY_FAMILY[family], body)).toEqual([...expectedFields].sort());
  });
});
