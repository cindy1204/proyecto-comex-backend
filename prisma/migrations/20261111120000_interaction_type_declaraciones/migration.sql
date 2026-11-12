-- Declaración de cambio para servicios, inversiones y endeudamiento (datos mínimos).
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'formulario-servicios';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'formulario-inversiones';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'formulario-endeudamiento';
