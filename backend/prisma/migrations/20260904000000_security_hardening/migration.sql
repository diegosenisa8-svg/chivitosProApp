-- Versión de sesión: permite invalidar los tokens ya emitidos de un admin
-- (por ejemplo al cambiar su contraseña) sin esperar a que expiren.
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Índices sobre las columnas por las que efectivamente se filtra y ordena en
-- el dashboard, los reportes, el listado de pedidos y la biblioteca de extras.
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_customerAccountId_idx" ON "Order"("customerAccountId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "ModifierGroup_externalId_idx" ON "ModifierGroup"("externalId");
CREATE INDEX IF NOT EXISTS "Customer_lastOrderAt_idx" ON "Customer"("lastOrderAt");
