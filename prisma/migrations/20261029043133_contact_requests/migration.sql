-- CreateTable
CREATE TABLE "contact_requests" (
    "id" TEXT NOT NULL,
    "nombre_completo" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "empresa" VARCHAR(160),
    "telefono" VARCHAR(40),
    "tipo_producto" VARCHAR(40) NOT NULL,
    "respuestas" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_requests_created_at_idx" ON "contact_requests"("created_at");

-- CreateIndex
CREATE INDEX "contact_requests_tipo_producto_created_at_idx" ON "contact_requests"("tipo_producto", "created_at");
