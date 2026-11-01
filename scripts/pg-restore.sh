#!/usr/bin/env bash
# Rebuild the local PostgreSQL for this sandbox after a VM replacement.
# Why: the sandbox has no Docker; apt installs and /opt + /var/lib do NOT survive
# VM replacement, but this project directory does. PostgreSQL refuses to run as
# root, and only root can read this home mount (idmapped), so binaries and data
# must live in system dirs owned by the unprivileged `pguser` account.
# Source binaries: the pgserver wheel inside .pg-venv/ (kept in the project).
# Idempotent: safe to re-run; existing data is kept.
set -euo pipefail
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SP="$PROJ/.pg-venv/lib/python3.12/site-packages"
BIN=/opt/resqflow-pgsql/bin
DATA=/var/lib/resqflow-pgdata
export LD_LIBRARY_PATH=/opt/resqflow-pgsql/pgserver.libs:/opt/resqflow-pgsql/lib

id pguser >/dev/null 2>&1 || useradd -r -s /bin/bash pguser
if [ ! -x "$BIN/initdb" ]; then
  rm -rf /opt/resqflow-pgsql
  cp -r "$SP/pgserver/pginstall" /opt/resqflow-pgsql
  cp -r "$SP/pgserver.libs" /opt/resqflow-pgsql/pgserver.libs
  chown -R pguser /opt/resqflow-pgsql
fi
if [ ! -s "$DATA/PG_VERSION" ]; then
  mkdir -p "$DATA" && chown -R pguser "$DATA" && chmod 700 "$DATA"
  printf 'resqflow_dev_password' > /tmp/pgpw.txt && chmod 644 /tmp/pgpw.txt
  runuser -u pguser -- /usr/bin/env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$BIN/initdb" -D "$DATA" -U resqflow --pwfile=/tmp/pgpw.txt --auth-host=scram-sha-256 --auth-local=trust -E UTF8 >/dev/null
  rm -f /tmp/pgpw.txt
fi
if ! "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  runuser -u pguser -- /usr/bin/env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$BIN/pg_ctl" -D "$DATA" -o "-p 5432 -h 127.0.0.1" -l "$DATA/server.log" start
fi
export PGPASSWORD=resqflow_dev_password
for db in resqflow resqflow_test; do
  "$BIN/psql" -h 127.0.0.1 -U resqflow -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || "$BIN/createdb" -h 127.0.0.1 -U resqflow "$db"
done
export PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
cd "$PROJ/backend"
DATABASE_URL="postgresql://resqflow:resqflow_dev_password@localhost:5432/resqflow" npx prisma migrate deploy >/dev/null
DATABASE_URL="postgresql://resqflow:resqflow_dev_password@localhost:5432/resqflow_test" npx prisma migrate deploy >/dev/null
npm run db:seed >/dev/null 2>&1 || true
echo "PostgreSQL ready: 127.0.0.1:5432, DBs resqflow + resqflow_test migrated (dev seeded)."
