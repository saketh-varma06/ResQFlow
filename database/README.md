# Database
PostgreSQL 16, run locally via the root `docker-compose.yml` (`postgres` service).
- Init scripts: `database/init/` (executed by Postgres on first boot of a fresh volume)
- ORM schema (source of truth for the app): `backend/prisma/schema.prisma`
- Local start: `npm run db:up` from the repo root, then `npm run db:generate` / `npm run db:migrate` in the backend workspace.
