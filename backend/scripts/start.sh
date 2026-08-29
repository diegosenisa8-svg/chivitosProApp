#!/bin/sh
set -e

echo "==> Waiting for database (DATABASE_URL)..."
i=1
max=30
until npx prisma migrate deploy; do
  if [ "$i" -ge "$max" ]; then
    echo "ERROR: Prisma migrate failed after ${max} attempts (P1001 / DB unreachable)."
    echo "Check Railway: API service Variables → DATABASE_URL = \${{Postgres.DATABASE_URL}}"
    echo "Both services must be in the same project/environment, and Postgres Online."
    exit 1
  fi
  echo "Migrate attempt $i/$max failed — retry in 3s..."
  i=$((i + 1))
  sleep 3
done

if [ "$FORCE_MENU_SEED" = "1" ]; then
  echo "==> FORCE_MENU_SEED=1 → seed --force (reemplaza menú + pedidos)"
  node prisma/seed.js --force || echo "WARN: force seed failed, continuing boot"
else
  echo "==> Seed (non-fatal)"
  node prisma/seed.js || echo "WARN: seed failed, continuing boot"
fi

echo "==> Starting API on 0.0.0.0:${PORT:-8080}"
exec node src/index.js
