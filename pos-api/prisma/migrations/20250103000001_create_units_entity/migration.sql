-- Migración para crear entidad Unit independiente y actualizar ProductUnit

-- Paso 1: Crear tabla Unit
CREATE TABLE "public"."Unit" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- Paso 2: Crear índice único para code
CREATE UNIQUE INDEX "Unit_code_key" ON "public"."Unit"("code");

-- Paso 3: Insertar unidades estándar
INSERT INTO "public"."Unit" ("code", "name", "symbol", "isActive") VALUES
('UND', 'Unidad', 'u', true),
('DOC', 'Docena', 'doc', true),
('CAJ', 'Caja', 'caj', true),
('KG', 'Kilogramo', 'kg', true),
('L', 'Litro', 'L', true),
('M', 'Metro', 'm', true);

-- Paso 4: Crear tabla temporal para ProductUnit con nueva estructura
CREATE TABLE "public"."ProductUnit_new" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "factor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductUnit_new_pkey" PRIMARY KEY ("id")
);

-- Paso 5: Migrar datos existentes de ProductUnit
INSERT INTO "public"."ProductUnit_new" ("productId", "unitId", "factor", "isActive", "createdAt", "updatedAt")
SELECT 
    pu."productId",
    u."id" as "unitId",
    pu."factor",
    pu."isActive",
    pu."createdAt",
    pu."updatedAt"
FROM "public"."ProductUnit" pu
JOIN "public"."Unit" u ON u."code" = pu."unitCode";

-- Paso 6: Eliminar tabla ProductUnit original
DROP TABLE "public"."ProductUnit";

-- Paso 7: Renombrar tabla nueva
ALTER TABLE "public"."ProductUnit_new" RENAME TO "ProductUnit";

-- Paso 8: Crear índices y restricciones
CREATE UNIQUE INDEX "ProductUnit_productId_unitId_key" ON "public"."ProductUnit"("productId", "unitId");

-- Paso 9: Agregar claves foráneas
ALTER TABLE "public"."ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProductUnit" ADD CONSTRAINT "ProductUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
