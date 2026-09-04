-- Auth con Google: sub único y contraseña opcional (cuentas solo-Google).
ALTER TABLE "CustomerAccount" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAccount_googleSub_key" ON "CustomerAccount"("googleSub");
ALTER TABLE "CustomerAccount" ALTER COLUMN "passwordHash" DROP NOT NULL;
