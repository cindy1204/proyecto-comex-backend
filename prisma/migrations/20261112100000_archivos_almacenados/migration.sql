-- CreateTable
CREATE TABLE "archivos_almacenados" (
    "id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivos_almacenados_pkey" PRIMARY KEY ("id")
);

