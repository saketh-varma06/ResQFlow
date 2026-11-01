# Tests
Phase 0: package-level tests live with each workspace.
- Backend: `backend/src/health.test.ts` — supertest check of `GET /api/health` (Vitest).
- Frontend: `frontend/src/lib/utils.test.ts` — smoke test of the `cn()` utility (Vitest).
Root: `npm test` runs both workspaces. Cross-service / e2e tests will be added here in later phases.
