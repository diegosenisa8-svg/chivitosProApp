-- Idempotencia de POST /api/orders (doble clic / reintentos).
CREATE TABLE IF NOT EXISTS "OrderIdempotency" (
  "key" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "OrderIdempotency_createdAt_idx" ON "OrderIdempotency"("createdAt");
