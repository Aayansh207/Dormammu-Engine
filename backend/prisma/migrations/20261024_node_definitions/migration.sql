-- Safe, data-preserving migration for node_definitions metadata table

CREATE TABLE IF NOT EXISTS "node_definitions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "configSchema" JSONB,
    "capabilities" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "node_definitions_type_version_key" ON "node_definitions"("type", "version");
CREATE INDEX IF NOT EXISTS "node_definitions_type_idx" ON "node_definitions"("type");
CREATE INDEX IF NOT EXISTS "node_definitions_category_idx" ON "node_definitions"("category");
