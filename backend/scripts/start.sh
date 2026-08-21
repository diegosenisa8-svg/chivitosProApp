#!/bin/sh
set -e

echo "==> Prisma migrate deploy"
npx prisma migrate deploy

if [ "$FORCE_MENU_SEED" = "1" ]; then
  echo "==> FORCE_MENU_SEED=1 → seed --force (reemplaza menú + pedidos)"
  node prisma/seed.js --force || echo "WARN: force seed failed, continuing boot"
else
  echo "==> Seed (non-fatal)"
  node prisma/seed.js || echo "WARN: seed failed, continuing boot"
fi

echo "==> Starting API on 0.0.0.0:${PORT:-8080}"
exec node src/index.js
