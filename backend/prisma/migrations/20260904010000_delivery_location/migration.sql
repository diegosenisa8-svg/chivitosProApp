-- Ubicación del pedido de delivery. La dirección deja de escribirse a mano:
-- se guarda la coordenada que reporta el navegador, la zona que resolvió el
-- servidor a partir de ella, y si cayó fuera de todas las zonas activas.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "locationAccuracy" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryZoneName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "outOfRange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "addressDetail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "addressReference" TEXT;
