-- Clientes del admin también se crean al registrarse / iniciar sesión (Google).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "customerAccountId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_customerAccountId_key" ON "Customer"("customerAccountId");
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");

-- Las cuentas nuevas sin pedidos empiezan en 0; el default viejo era 1.
ALTER TABLE "Customer" ALTER COLUMN "orderCount" SET DEFAULT 0;
