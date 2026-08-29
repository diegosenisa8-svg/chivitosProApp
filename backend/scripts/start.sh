#!/bin/sh
set -e

# Si la red privada de Railway falla, se puede usar el proxy público.
# En el servicio API: DATABASE_PUBLIC_URL = ${{Postgres.DATABASE_PUBLIC_URL}}
use_public_db() {
  if [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
    echo "==> Switching DATABASE_URL → DATABASE_PUBLIC_URL (Railway TCP proxy)"
    export DATABASE_URL="$DATABASE_PUBLIC_URL"
    return 0
  fi
  return 1
}

echo "==> Waiting for database..."
echo "    DATABASE_URL host: $(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"

i=1
max=20
switched=0
until npx prisma migrate deploy; do
  if [ "$switched" -eq 0 ] && use_public_db; then
    switched=1
    echo "==> Retrying migrate with public database URL..."
    continue
  fi
  if [ "$i" -ge "$max" ]; then
    echo "ERROR: Prisma migrate failed after ${max} attempts."
    echo "Railway checklist:"
    echo "  1) Postgres Online"
    echo "  2) API Variables: DATABASE_URL=\${{Postgres.DATABASE_URL}}"
    echo "  3) API Variables: DATABASE_PUBLIC_URL=\${{Postgres.DATABASE_PUBLIC_URL}}"
    echo "  4) Same project + environment for API and Postgres"
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
