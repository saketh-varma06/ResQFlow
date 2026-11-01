#!/usr/bin/env bash
# Local PostgreSQL control for THIS sandbox (see pg-restore.sh for the full story).
export LD_LIBRARY_PATH=/opt/resqflow-pgsql/pgserver.libs:/opt/resqflow-pgsql/lib
BIN=/opt/resqflow-pgsql/bin; DATA=/var/lib/resqflow-pgdata
case "${1:-status}" in
  start) runuser -u pguser -- /usr/bin/env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$BIN/pg_ctl" -D "$DATA" -o "-p 5432 -h 127.0.0.1" -l "$DATA/server.log" start ;;
  stop)  runuser -u pguser -- /usr/bin/env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$BIN/pg_ctl" -D "$DATA" stop ;;
  status) runuser -u pguser -- /usr/bin/env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$BIN/pg_ctl" -D "$DATA" status || true ;;
  psql)  PGPASSWORD=resqflow_dev_password "$BIN/psql" -h 127.0.0.1 -U resqflow -d "${2:-resqflow}" ;;
  *) echo "usage: pg-local.sh [start|stop|status|psql [db]]" ;;
esac
