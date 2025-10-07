-- Migración para remover el enum UnitCode y permitir unidades personalizadas
-- Cambiar unitBase de enum a string

-- Paso 1: Crear columna temporal
ALTER TABLE "public"."Product" ADD COLUMN "unitBase_temp" TEXT;

-- Paso 2: Copiar datos existentes convirtiendo enum a string
UPDATE "public"."Product" SET "unitBase_temp" = "unitBase"::TEXT;

-- Paso 3: Eliminar columna original y renombrar temporal
ALTER TABLE "public"."Product" DROP COLUMN "unitBase";
ALTER TABLE "public"."Product" RENAME COLUMN "unitBase_temp" TO "unitBase";

-- Paso 4: Establecer valor por defecto
ALTER TABLE "public"."Product" ALTER COLUMN "unitBase" SET DEFAULT 'UND';

-- Paso 5: Hacer la columna NOT NULL
ALTER TABLE "public"."Product" ALTER COLUMN "unitBase" SET NOT NULL;
