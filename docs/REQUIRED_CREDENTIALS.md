# ResQFlow — Required Credentials & Account Checklist (Deployment Day)

This is the checklist of accounts and credentials **you** (the project owner)
need to create so ResQFlow can be deployed. It is written for "tomorrow's"
deployment session: MongoDB Atlas, GitHub, a backend host (Render) and a
frontend host (Vercel).

> ## ⚠️ NEVER share passwords or one-time codes with the assistant
>
> **You must NEVER share any password, OTP / one-time code, recovery code, or
> full connection string containing a password with the assistant — not in
> chat, not in a file, not in a screenshot.**
>
> - Create every account yourself, on the service's own website.
> - Type every password and OTP only into that service's own sign-in page, or
>   into a secure entry prompt the platform itself shows you.
> - Enter secrets such as `MONGODB_URI`, `DATABASE_URL` and `JWT_SECRET`
>   **only into the hosting provider's environment-variable settings** (or
>   your own password manager) — never into git, never into this repository,
>   never into chat.
> - The assistant works with **public, non-secret facts only**: service names,
>   cluster/region names, public URLs (frontend/backend/database hostnames
>   without credentials), and whether a step succeeded. If you are ever asked
>   for a password or OTP in chat, refuse — that request did not come from a
>   legitimate workflow step.

Current deployment status: **ResQFlow is not deployed anywhere and no public
URL exists.** The local code is committed locally (initial commit) but, at the
time of writing, the repository has **no Git remote** — §5 below is how that
changes.

A note on databases, to avoid a costly misunderstanding:

- **The running application uses PostgreSQL** (Prisma, `DATABASE_URL`).
  Production PostgreSQL is covered in §6/§8 — the backend host needs a real
  PostgreSQL database for the app to work at all.
- **MongoDB Atlas (§1–§4) is a separately prepared layer** (`database/mongodb/`)
  that is **not connected yet**. Creating the Atlas account/cluster prepares
  it for wiring and testing; it does **not** replace PostgreSQL, and Atlas must
  never be described as "connected" until a real connection test with the real
  `MONGODB_URI` has succeeded.

---

## 1. MongoDB Atlas — account and free cluster

Official site: **https://www.mongodb.com/atlas**

1. Open https://www.mongodb.com/atlas in your browser.
2. Choose **Sign up** / **Try Free** and create the account with your own email
   (or your existing Atlas/Google sign-in). Complete any email verification
   and OTP step **on the Atlas site itself**.
3. If Atlas asks you to create an **Organization** and **Project**, create one
   project for ResQFlow (any clear name, e.g. `ResQFlow`).
4. On the project page, choose **Build a Database** / **Create a cluster**.
5. Choose the **free tier (M0)** cluster.
6. Choose a cloud region reasonably close to where the backend will be hosted
   (you will pick the backend region in §6 — keeping the database and backend
   in nearby regions reduces latency). Note the region you picked; it is a
   non-secret fact you can tell the assistant.
7. Name the cluster (e.g. `resqflow-cluster`) and confirm **Create**.
8. Wait until Atlas reports the cluster as active/ready. Note the cluster
   name and region — again, non-secret facts.

**Do not** paste any Atlas password or connection string into chat at any
point in this section.

## 2. Atlas — database user (least privilege)

Still in https://cloud.mongodb.com (the Atlas console you reach from
https://www.mongodb.com/atlas):

1. In the left navigation, open **Database Access** (under *Security*).
2. Choose **Add New Database User**.
3. Choose authentication method **Password**.
4. Enter a username (e.g. `resqflow-app`) and generate a **new, unique, strong
   password** for this database user. Save it directly into **your password
   manager**. This is a database password, not your Atlas account password —
   never reuse your account password here, and never share this password.
5. Under **Database User Privileges**, grant only what the prepared MongoDB
   layer needs: **read and write to the ResQFlow database only**
   (`readWrite` scoped to that one database — in the Atlas UI: *Add Specific
   Privilege* → `readWrite` → select the ResQFlow database). If you have not
   named the database yet, use the name agreed for this project layer and note
   it (a name is not a secret).
   - Do **not** grant `Atlas admin`, `Owner`, or read/write access to *all*
     databases. Least privilege matters because this credential will live in
     the hosting environment.
6. Choose **Add User** and confirm the user appears in the list as enabled.

## 3. Atlas — network access (IP allowlist)

Still in the Atlas console:

1. In the left navigation, open **Network Access** (under *Security*).
2. Choose **Add IP Address**.
3. Add the addresses from which the **hosted backend** will connect:
   - **Hosting-egress consideration (important):** the connections will come
     from your backend host (e.g. Render), not from your home/office IP. Your
     home IP is useless here except for your own one-off testing from your
     machine.
   - Some PaaS hosts use **dynamic/shared egress IPs** or publish a list of
     outbound IP ranges rather than one fixed IP. Check your backend host's
     documentation/settings for its outbound IP addresses or ranges and add
     exactly those.
   - If the host offers no fixed egress IPs, the pragmatic fallback is
     `0.0.0.0/0` ("allow access from anywhere"). Atlas will warn you about
     this, and the warning is correct: it means the database relies entirely
     on the database user's password for protection. If you use it, say so
     plainly, use the strong unique password from §2, keep the user scoped to
     the one database — and tighten the allowlist later if the host gives you
     fixed IPs.
4. Add a comment naming what each entry is (e.g. `Render backend egress`) so
   future-you can audit the list.
5. Confirm, and wait until every entry shows as **Active**.
6. If you also want to test from your own machine, add your current public IP
   as a separate, clearly commented entry — and remove it when testing is done.

## 4. Atlas — connection string and where it goes

1. In the Atlas console, open **Database** (Clusters), find your cluster, and
   choose **Connect**.
2. Choose the **Drivers** connection method (Node.js driver — this project is
   a Node/Express backend).
3. Atlas shows a connection string of the shape
   `mongodb+srv://<username>:<password>@<cluster-host>/<database>?…`.
   Replace the `<password>` placeholder with the database-user password from
   §2 — do this **in your password manager / directly in the hosting
   settings**, not in a document or chat message. If the password contains
   special characters, they must be URL-encoded in the string (Atlas's own
   guidance on the Connect page covers this).
4. Store the completed string as **`MONGODB_URI`** in exactly one production
   place: **the backend host's environment-variable settings** (created in
   §6). That is where the prepared MongoDB layer will read it from.
5. Rules for this value, without exception:
   - **Never in git** — `.env` files are git-ignored in this repo for exactly
     this reason; do not force-add one, and do not put the string in code,
     docs, or the repository's README.
   - **Never in chat** — the assistant does not need the value itself, only
     confirmation that it has been set in the hosting settings (§9 tests the
     connection without anyone reading the secret aloud).
   - Locally, if you need it for a one-off test, put it only in your local
     git-ignored `backend/.env` on your own machine.
6. Tell the assistant only these non-secret facts: that `MONGODB_URI` has been
   set in the hosting environment, the cluster name/region, and the database
   name.

## 5. GitHub — account and private repository

Official site: **https://github.com**

1. Sign in at https://github.com with your own GitHub account (create one
   there first if you do not have one — password and any 2FA/OTP go only into
   github.com).
2. Create the repository: top-right **+** menu → **New repository**.
   - Name: e.g. `resqflow` (or `disaster-management-platform`).
   - Visibility: **Private**.
   - Do **not** add a README, `.gitignore`, or licence — the local repository
     already has its own initial commit and history; initialising the remote
     with extra files creates an unnecessary merge.
   - Choose **Create repository**.
3. GitHub shows the new (empty) repository URL. Copy the HTTPS URL
   (`https://github.com/<your-username>/<repo-name>.git`). The URL itself is
   not a secret and is the one deployment fact the assistant needs from this
   section.
4. The push itself (adding this URL as the `origin` remote of the local repo
   and pushing the existing initial commit) is done **after you authorise it**
   — see the division of work at the end of this document. For reference, the
   commands are the standard ones GitHub displays for "push an existing
   repository from the command line":
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
   (The local repository currently has one commit — the initial ResQFlow
   commit — and no remote, verified at the time this checklist was written.)
5. If GitHub asks for authentication during the push, authenticate **through
   GitHub's own flow** (browser sign-in / GitHub CLI / personal access token
   entered into the credential prompt on your machine). Never paste a token
   or password into chat.
6. Sanity-check on github.com after the push: the file list matches the local
   project, and **no `.env` file is present** (the repo's `.gitignore`
   excludes `.env` / `.env.*` except `.env.example`).

## 6. Backend hosting — Render (Node web service)

Official site: **https://render.com**

1. Sign up / sign in at https://render.com using your GitHub account
   ("Sign in with GitHub" authorises Render to access the repositories you
   choose — grant access to the ResQFlow repository from §5; Render's
   authorisation happens on render.com/github.com, never via chat).
2. First, the production PostgreSQL database (the app cannot run without it):
   in the Render dashboard choose **New +** → **PostgreSQL**, pick the current
   PostgreSQL major version offered that matches the project's PostgreSQL 16
   target as closely as the plan allows, choose a region (near your Atlas
   region from §1 if you also created Atlas), and create it. Note its
   **internal** connection string location in the dashboard — you will wire
   it as `DATABASE_URL` in step 5 without copying it anywhere else. (An
   external managed PostgreSQL from another provider works equally well —
   what matters is a valid `DATABASE_URL`.)
3. Create the backend service: **New +** → **Web Service** → connect the
   ResQFlow GitHub repository.
4. Configure the service:
   - **Runtime:** Node (or **Docker**, using the repo's
     `docker/backend.Dockerfile`, if you prefer the container path — note the
     Docker artefacts were YAML-verified but not executed in the build
     sandbox; the native Node path below is the one this checklist verifies).
   - **Root directory:** repository root (the project is an npm-workspaces
     monorepo).
   - **Build command:** `npm install && npm run prisma:generate -w backend && npm run build -w backend`
   - **Pre-deploy / release command** (if your plan/settings expose one):
     `npx prisma migrate deploy` run from the `backend/` directory — see §9.
     If there is no pre-deploy hook, the migration is run another authorised
     way before the new version is declared live; it must not be skipped.
   - **Start command:** `npm run start -w backend`
   - **Health check path:** `/api/health`
   - **Region:** the one you chose in step 2.
   - Let Render set `PORT` itself (it injects it); do not hard-code a port in
     the dashboard.
5. In the service's **Environment** settings, add the production variables
   from the table in §8 — including `DATABASE_URL` from step 2 and, if you
   completed §1–§4, `MONGODB_URI`. Type secrets directly into these fields.
6. Deploy. Watch the build/deploy log **in the Render dashboard** for: install
   success, Prisma client generation, TypeScript build success, and the
   startup line `ResQFlow backend listening on …`.
7. Note the service's public URL (`https://<service-name>.onrender.com` or
   your custom domain). This URL is not a secret — the assistant needs it for
   §9/§10 verification and for the frontend build in §7.
8. Billing: the free tiers may sleep/expire (including free PostgreSQL
   expiry). If Render asks for a payment method for the tier you choose,
   that decision and entry happen **only by you, only on render.com**.

## 7. Frontend hosting — Vercel (static build)

Official site: **https://vercel.com**

1. Sign up / sign in at https://vercel.com (again, "Continue with GitHub" is
   the straightforward route; all authorisation happens on vercel.com /
   github.com).
2. Choose **Add New… → Project** and import the ResQFlow GitHub repository
   from §5.
3. Configure the project for the monorepo:
   - **Root directory:** `frontend/` — or keep the repository root and use the
     explicit commands below; pick one approach and note which you used.
   - **Framework preset:** Vite.
   - **Build command:** `npm run build` inside `frontend/` (which runs
     `tsc -b && vite build`), equivalently `npm run build -w frontend` from
     the repository root.
   - **Output directory:** `frontend/dist` (just `dist` if the root directory
     is set to `frontend/`).
   - **Install command:** the workspace-aware default (`npm install` at the
     repository root) so the frontend workspace's dependencies resolve.
4. In **Settings → Environment Variables**, add **`VITE_API_URL`** set to the
   backend's final public URL from §6 step 7 (e.g.
   `https://<service-name>.onrender.com`). This value is **not** a secret, but
   it is **build-time**: it is baked into the bundle, so it must be set
   *before* the production build runs. Changing it later requires a redeploy.
   - Do **not** set `VITE_SOCKET_URL` expecting an effect — the code derives
     the socket target from `VITE_API_URL` (recorded doc drift in
     `docs/PROJECT_AUDIT.md`).
5. Deploy. Confirm the build log shows the Vite build completing and the PWA
   service worker (`sw.js`) among the output assets.
6. Note the production frontend URL (`https://<project>.vercel.app` or your
   custom domain). Not a secret.
7. **Go back to Render** and set the backend's `CORS_ORIGIN` to exactly this
   frontend origin (scheme + host, no trailing slash — add your custom domain
   too if both will be used, comma-separated), then redeploy/restart the
   backend. Skipping this step is the most common cause of "login works
   nowhere / realtime never connects" in this app, because CORS is a
   credentialed allowlist and Socket.IO connects cross-origin.
8. SPA routing: Vercel serves the Vite SPA correctly with its default Vite
   handling; verify deep links (e.g. opening `/login` directly) load the app
   during §10 — if they 404, add the host's SPA fallback/rewrite to
   `index.html` as described in `docs/DEPLOYMENT_GUIDE.md` §4.4.

## 8. Production environment variables — complete setup table

Set these **in the hosting providers' environment settings** (Render for the
backend, Vercel for the frontend). Full explanations and rationale are in
`docs/DEPLOYMENT_GUIDE.md` §2.

### Backend (Render web service)

| Variable | Production value / rule |
|---|---|
| `NODE_ENV` | `production` (required for `Secure` session cookies and the seed-admin demo-password refusal) |
| `PORT` | Do not set manually on Render — the host injects it. (`4000` is the app's default/local value.) |
| `DATABASE_URL` | The production PostgreSQL connection string from your database provider (§6 step 2), `postgresql://…?schema=public`. Secret — hosting settings only. |
| `JWT_SECRET` | A **new** long random value generated by you (e.g. 32+ random bytes / 48+ characters). Never the template placeholder, never the local dev value. Secret. |
| `JWT_EXPIRES_IN` | `7d` (the shipped default) |
| `BCRYPT_SALT_ROUNDS` | `12` (the shipped default) |
| `CORS_ORIGIN` | The exact frontend origin(s) from §7 step 6, comma-separated, no trailing slash. Never `*`. |
| `MONGODB_URI` | Only if §1–§4 were completed: the completed Atlas connection string. Secret — hosting settings only, never git, never chat. The app does not depend on it yet (PostgreSQL is the live database). |
| `TEST_DATABASE_URL` | **Do not set in production.** Test-suite only, on machines that run tests. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Only for the Docker Compose path (`docs/DEPLOYMENT_GUIDE.md` §3). Not used when the provider supplies `DATABASE_URL` directly. |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | One-off only, for the `npm run db:seed-admin` run that creates the first production admin (§9 step 3). Password ≥ 12 characters, unique, held in your password manager. Do not leave `ADMIN_PASSWORD` set on the running service afterwards. |

### Frontend (Vercel project)

| Variable | Production value / rule |
|---|---|
| `VITE_API_URL` | The backend's public URL from §6 step 7. Build-time — set before building; changing it needs a redeploy. Not a secret. |
| `VITE_SOCKET_URL` | Do not set — not read by the code. |

### Never in production

- The demo seed accounts (`admin@resqflow.local` etc. from the README) and
  `npm run db:seed` — local development only.
- Any value copied from `.env.example` placeholders (`change_me_…`,
  `resqflow_dev_password`).

## 9. Production database connection test

Run these after §6 (and §8) are complete, in order:

1. **Health endpoint — database field.** Open (or `curl`)
   `https://<your-backend-host>/api/health`. Expected: HTTP 200 with
   `"status": "ok"` **and `"database": "up"`** and
   `"environment": "production"`. The endpoint performs a real `SELECT 1`
   via Prisma on every call.
   - If `database` is `"down"`: the process is up but PostgreSQL is
     unreachable — re-check `DATABASE_URL` in the Render environment (correct
     string? correct database? internal vs external URL for the host?) and
     that the database service itself is running. Do not proceed until it
     reads `"up"`.
   - If there is no response at all: check the Render deploy/start logs first.
2. **Migrations actually applied.** Confirm the release ran
   `npx prisma migrate deploy` against the production database (deploy log),
   applying the committed migrations from `backend/prisma/migrations/`. An
   empty-but-connected database without migrations will pass step 1 and fail
   step 3 — that distinction is exactly what these steps are for.
3. **First admin.** Run the safe seeder once against production
   (`ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` per §8) and confirm it
   prints the "Admin ready" line naming your admin email (it never prints the
   password).
4. **Register/login smoke test.** Through the deployed frontend (§7, or the
   API directly): register a **new citizen test account** with a throwaway
   email and a password you keep, then log out and log back in. Expected:
   registration succeeds (citizens activate immediately), login sets the
   session and lands on the citizen dashboard, and the account still exists
   after a backend restart/redeploy — proving real database persistence.
5. **Atlas connection test (only if §1–§4 were done).** After the assistant
   wires the prepared `database/mongodb/` layer to read `MONGODB_URI` from
   the environment (see the division of work below), a real connection
   attempt is made from the backend environment and its success/failure is
   reported from the actual result — Atlas is only called "connected" if
   that test genuinely succeeds. You can cross-check in the Atlas console
   under **Database Access / Network Access** activity and the cluster's
   Connections metric. A failed test is reported as failed, with the error —
   never as success.

## 10. Final deployment — end-to-end verification

Run every item against the **public URLs** (not localhost) and record the
results with the date:

1. `GET https://<backend>/api/health` → `status: "ok"`, `database: "up"`,
   `environment: "production"` (§9 step 1).
2. `GET https://<backend>/api/docs` loads the OpenAPI/Swagger UI (39 paths)
   and `GET https://<backend>/` returns the service identity JSON.
3. The frontend URL loads over HTTPS with no certificate or mixed-content
   warnings; a hard refresh and a direct deep link (e.g. `/login`) both load
   the app (SPA fallback working).
4. Browser console shows **no CORS errors** on login or data loads — if it
   does, `CORS_ORIGIN` on the backend does not exactly match this frontend
   origin (§7 step 7).
5. **Citizen flow:** register → login → create a test SOS or incident report →
   it appears in *My Requests* with its server-assigned ID and priority →
   reload the page → it is still there (persistence) → log out → log back in
   → it is still there.
6. **Admin flow:** log in with the §9 step 3 admin → dashboard shows live
   analytics → the citizen's test record from step 5 is visible in Incident
   Management → change its status through one valid workflow step → the
   change is recorded (status history / audit log).
7. **Responder/realtime flow:** with a responder account active, acknowledge
   or assign the test record → the citizen, in a second browser/session,
   sees the update **live** (notification/toast and updated tracking) without
   manually refreshing — proving authenticated Socket.IO works across the
   two public origins.
8. **Shelters/alerts:** the landing page shows live shelters and alerts from
   the public API reads; the citizen shelters page shows capacity and
   availability consistent with the database.
9. **External data:** the citizen dashboard's external panel shows Open-Meteo
   weather, USGS and GDACS blocks with source and fetched-time provenance —
   or an honest `stale`/`unavailable` state. Fabricated-looking data with no
   provenance is a failure, not a pass.
10. **Session security spot-checks:** after logout, the previous session no
    longer works (tokenVersion invalidation); a RESPONDER-role registration
    stays `PENDING` and cannot log in until the admin activates it.
11. **PWA:** the site is installable (manifest served) and, after a first
    load, reloading with the network offline shows the app shell with the
    offline indicator rather than a browser error page.
12. Record the final public URLs (frontend + backend), the deployed commit,
    and these results in `docs/DEVELOPMENT_PROGRESS.md` — and only now
    describe the project as deployed.

---

## Who does what

### Only you can do these (never delegable, never via chat)

- Create the Atlas, GitHub, Render and Vercel accounts and complete their
  sign-up, email verification, and any OTP/2FA steps.
- Choose and enter **every password**: Atlas account, Atlas database user,
  GitHub, Render, Vercel, the production admin account, and generated secrets
  such as `JWT_SECRET`.
- Enter **every secret value** into the hosting environment settings:
  `DATABASE_URL`, `MONGODB_URI`, `JWT_SECRET`, database passwords.
- Authorise third-party access (GitHub → Render/Vercel repository access) on
  the providers' own authorisation screens.
- Approve any **billing** decision: paid tiers, payment methods, and accepting
  that free tiers may sleep or expire.
- Set the Atlas IP allowlist (§3) and decide whether the `0.0.0.0/0` fallback
  is acceptable if the host has no fixed egress IPs.
- Decide the production admin's email and password, and the final public
  domains, if custom domains are used.

### The assistant will do these, after your authorisation

- Add the GitHub remote to the local repository and **push the existing local
  commit** (§5) once you provide the repository URL and say to push.
- Prepare/verify the deployment configuration in the repo (build/start
  commands, health-check path, `docs/DEPLOYMENT_GUIDE.md` alignment) for the
  Render and Vercel settings in §6/§7.
- Wire the prepared MongoDB layer's configuration to read **`MONGODB_URI`
  from the environment** (config/code only — the assistant never sees or
  handles the value itself) once you confirm it is set in the hosting
  settings.
- Run (or give you the exact commands for) the production migration
  `npx prisma migrate deploy` and the `db:seed-admin` step, and read back
  their results.
- Run the **verification steps in §9 and §10** against the public URLs —
  health endpoint including the `database` field, register/login smoke test,
  end-to-end citizen/admin/realtime checks — and report the results exactly
  as observed, including any failure.
- Record the deployment outcome (URLs, commit, verification results) in
  `docs/DEVELOPMENT_PROGRESS.md`.

> The dividing line is simple: **accounts, passwords, OTPs, secrets and
> billing are yours alone, entered only on the services' own sites;
> code, configuration, pushes, migrations and verification are the
> assistant's work once you authorise them.**
