-- Migración para agregar unidades dinámicas
-- Paso 1: Agregar nuevas columnas a ProductUnit con valores por defecto
ALTER TABLE "public"."ProductUnit" 
ADD COLUMN "unitName" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Paso 2: Actualizar unitName basado en unitCode existente
UPDATE "public"."ProductUnit" 
SET "unitName" = CASE 
  WHEN "unitCode" = 'UND' THEN 'Unidad'
  WHEN "unitCode" = 'DOC' THEN 'Docena'
  WHEN "unitCode" = 'CAJ' THEN 'Caja'
  ELSE 'Unidad'
END;

-- Paso 3: Hacer unitName NOT NULL después de actualizar
ALTER TABLE "public"."ProductUnit" ALTER COLUMN "unitName" SET NOT NULL;

-- Paso 4: Crear columnas temporales para unitCode
ALTER TABLE "public"."ProductUnit" ADD COLUMN "unitCode_temp" TEXT;
ALTER TABLE "public"."PurchaseItem" ADD COLUMN "unitCode_temp" TEXT;
ALTER TABLE "public"."SaleItem" ADD COLUMN "unitCode_temp" TEXT;

-- Paso 5: Copiar datos existentes
UPDATE "public"."ProductUnit" SET "unitCode_temp" = "unitCode"::TEXT;
UPDATE "public"."PurchaseItem" SET "unitCode_temp" = "unitCode"::TEXT;
UPDATE "public"."SaleItem" SET "unitCode_temp" = "unitCode"::TEXT;

-- Paso 6: Eliminar columnas originales y renombrar temporales
ALTER TABLE "public"."ProductUnit" DROP COLUMN "unitCode";
ALTER TABLE "public"."ProductUnit" RENAME COLUMN "unitCode_temp" TO "unitCode";

ALTER TABLE "public"."PurchaseItem" DROP COLUMN "unitCode";
ALTER TABLE "public"."PurchaseItem" RENAME COLUMN "unitCode_temp" TO "unitCode";

ALTER TABLE "public"."SaleItem" DROP COLUMN "unitCode";
ALTER TABLE "public"."SaleItem" RENAME COLUMN "unitCode_temp" TO "unitCode";

-- Paso 7: Crear índices únicos
CREATE UNIQUE INDEX "ProductUnit_productId_unitCode_key" ON "public"."ProductUnit"("productId", "unitCode");