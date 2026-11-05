ALTER TABLE "interacciones" ADD COLUMN "catalog_item_id" TEXT;

UPDATE "interacciones" AS interaction
SET "catalog_item_id" = catalog_item."id"
FROM "elementos_catalogo" AS catalog_item
WHERE catalog_item."active" = true
  AND catalog_item."category" = CASE interaction."type"
    WHEN 'formulario-importaciones' THEN 'importaciones'
    WHEN 'formulario-exportaciones' THEN 'exportaciones'
  END
  AND catalog_item."code" = CASE interaction."type"
    WHEN 'formulario-importaciones' THEN interaction."data" ->> 'numeralOperacion'
    WHEN 'formulario-exportaciones' THEN interaction."data" ->> 'numeralCambiario'
  END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "interacciones" WHERE "catalog_item_id" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asociar cada interacción existente con un elemento del catálogo.';
  END IF;
END $$;

ALTER TABLE "interacciones" ALTER COLUMN "catalog_item_id" SET NOT NULL;
CREATE INDEX "interacciones_catalog_item_id_idx" ON "interacciones"("catalog_item_id");
ALTER TABLE "interacciones"
  ADD CONSTRAINT "interacciones_catalog_item_id_fkey"
  FOREIGN KEY ("catalog_item_id") REFERENCES "elementos_catalogo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
