ALTER TABLE "solicitudes_contacto"
ADD COLUMN "user_id" TEXT;

CREATE INDEX "solicitudes_contacto_user_id_created_at_idx"
ON "solicitudes_contacto"("user_id", "created_at");

ALTER TABLE "solicitudes_contacto"
ADD CONSTRAINT "solicitudes_contacto_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
