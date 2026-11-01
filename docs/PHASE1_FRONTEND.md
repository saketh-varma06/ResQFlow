# Phase 1 — Frontend (complete)
All 25 screens built in `frontend/` with React + TypeScript + Tailwind + shadcn/ui + React Router + Recharts + Leaflet:
- Public: `/` Landing, `/about`, `/login`, `/register`
- Citizen (light layout): `/citizen` dashboard, `/citizen/sos`, `/citizen/report`, `/citizen/shelters`, `/citizen/alerts`, `/citizen/requests`, `/citizen/notifications`, `/citizen/profile`
- Responder (dark navy "command" layout): `/responder` command centre, `/responder/assigned`, `/responder/sos`, `/responder/incidents/:id`, `/responder/history`
- Admin (dark navy "command" layout): `/admin`, `/admin/incidents`, `/admin/alerts`, `/admin/shelters`, `/admin/users`, `/admin/responders`, `/admin/analytics`, `/admin/audit`
Design system: Inter/Sora typography, red=critical, amber=warning, green=safe/resolved, shared StatusBadge/SeverityBadge, PageHeader, StatCard, EmptyState and loading skeletons; responsive sidebars with mobile overlay; skip links, labels, focus rings and ARIA states.
Honesty rules honoured: no fake auth — login/register validate locally and state plainly that authentication is not connected yet (Phase 2); all sample records live in `frontend/src/data/previewData.ts`, are labelled "Preview data" on screen, and interactive actions (SOS, report, status changes, create alert/shelter/unit, occupancy, user management) update local state only.
Performance: routes are code-split with React.lazy (one chunk per page in the production build).
Verification: `npm run build -w frontend` passes (tsc + Vite); page chunks emitted for every page; root `npm test` and `npm run lint` re-run at the end of the phase.
Known limitations: no real API/auth/Socket.IO data yet (Phase 2 backend), Leaflet tiles need network at runtime, charts/maps use preview data, bundle still includes large shared chart/map vendor chunks (normal for Recharts/Leaflet).
