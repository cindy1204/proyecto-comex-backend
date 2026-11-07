-- Borrado lógico (state/deleted_at), enums de dominio, monto como Decimal y
-- nombres de restricciones alineados con las tablas renombradas al español.

-- CreateEnum
CREATE TYPE "RecordState" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('formulario-importaciones', 'formulario-exportaciones');

-- Catálogo: active -> state/deleted_at
ALTER TABLE "elementos_catalogo"
  ADD COLUMN "state" "RecordState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "elementos_catalogo"
SET "state" = 'REMOVED', "deleted_at" = "updated_at"
WHERE "active" = false;

DROP INDEX "catalog_items_category_direction_active_idx";
ALTER TABLE "elementos_catalogo" DROP COLUMN "active";

-- Interacciones: state/deleted_at/updated_at y type como enum
ALTER TABLE "interacciones"
  ADD COLUMN "state" "RecordState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "interacciones" SET "updated_at" = "created_at";
ALTER TABLE "interacciones" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "interacciones"
  ALTER COLUMN "type" TYPE "InteractionType" USING ("type"::"InteractionType");

DROP INDEX "interactions_user_id_created_at_idx";

-- Solicitudes de contacto: descripción como columna, monto Decimal, state/deleted_at/updated_at
ALTER TABLE "solicitudes_contacto"
  ADD COLUMN "descripcion_caso" TEXT,
  ADD COLUMN "monto_estimado" DECIMAL(14,2),
  ADD COLUMN "state" "RecordState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "solicitudes_contacto"
SET "descripcion_caso" = COALESCE("respuestas" ->> 'descripcionCaso', ''),
    "updated_at" = "created_at";

ALTER TABLE "solicitudes_contacto" ALTER COLUMN "descripcion_caso" SET NOT NULL;
ALTER TABLE "solicitudes_contacto" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "solicitudes_contacto" DROP COLUMN "respuestas";

DROP INDEX "contact_requests_created_at_idx";
DROP INDEX "contact_requests_tipo_producto_created_at_idx";
DROP INDEX "solicitudes_contacto_user_id_created_at_idx";

-- Índices nuevos
CREATE INDEX "elementos_catalogo_category_direction_state_idx" ON "elementos_catalogo"("category", "direction", "state");
CREATE INDEX "elementos_catalogo_state_created_at_idx" ON "elementos_catalogo"("state", "created_at");
CREATE INDEX "interacciones_user_id_state_created_at_idx" ON "interacciones"("user_id", "state", "created_at");
CREATE INDEX "interacciones_state_type_created_at_idx" ON "interacciones"("state", "type", "created_at");
CREATE INDEX "solicitudes_contacto_state_created_at_idx" ON "solicitudes_contacto"("state", "created_at");
CREATE INDEX "solicitudes_contacto_state_tipo_producto_created_at_idx" ON "solicitudes_contacto"("state", "tipo_producto", "created_at");
CREATE INDEX "solicitudes_contacto_user_id_state_created_at_idx" ON "solicitudes_contacto"("user_id", "state", "created_at");

-- Nombres de restricciones heredados de las tablas en inglés
ALTER TABLE "usuarios" RENAME CONSTRAINT "users_pkey" TO "usuarios_pkey";
ALTER TABLE "elementos_catalogo" RENAME CONSTRAINT "catalog_items_pkey" TO "elementos_catalogo_pkey";
ALTER TABLE "interacciones" RENAME CONSTRAINT "interactions_pkey" TO "interacciones_pkey";
ALTER TABLE "solicitudes_contacto" RENAME CONSTRAINT "contact_requests_pkey" TO "solicitudes_contacto_pkey";
ALTER TABLE "interacciones" RENAME CONSTRAINT "interactions_user_id_fkey" TO "interacciones_user_id_fkey";
ALTER INDEX "users_email_key" RENAME TO "usuarios_email_key";
ALTER INDEX "catalog_items_category_direction_code_key" RENAME TO "elementos_catalogo_category_direction_code_key";
