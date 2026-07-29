#!/bin/sh
set -e

echo "==> Prisma migrate deploy"
npx prisma migrate deploy

echo "==> Seed (non-fatal)"
node prisma/seed.js || echo "WARN: seed failed, continuing boot"

echo "==> Starting API on 0.0.0.0:${PORT:-8080}"
exec node src/index.js
