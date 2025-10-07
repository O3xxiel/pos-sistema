-- AlterEnum
ALTER TYPE "public"."SaleStatus" ADD VALUE 'PENDING_SYNC';

-- AlterTable
ALTER TABLE "public"."Sale" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;
