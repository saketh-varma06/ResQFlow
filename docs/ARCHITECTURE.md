# ResQFlow — Architecture (Phase 0)
Monorepo (npm workspaces):
- `frontend/` — React 19 + TypeScript + Vite, Tailwind CSS, shadcn/ui setup, React Router, Recharts, Leaflet / React-Leaflet.
- `backend/` — Node.js + Express + TypeScript, Prisma (PostgreSQL), Socket.IO, Zod-validated env/config, JWT + bcrypt auth foundations (full auth flows are a later phase).
- `database/` — Postgres init scripts and notes; Prisma schema lives in `backend/prisma/`.
- `docker/` — Dockerfiles for backend/frontend; root `docker-compose.yml` provides local PostgreSQL (and optional full stack via `--profile full`).
Communication (planned): REST (`/api/*`) + Socket.IO for real-time incident updates. Health: `GET /api/health`.
