============================================================
  CYBERSIGMA SECURITY PLATFORM
  Setup Guide for Karthik — End to End
  Written by Sathish | Days 1–10 Complete
============================================================

This guide will get you from zero to a fully running
backend + frontend in one sitting.
Estimated time: 30–45 minutes.

============================================================
SECTION 1 — WHAT YOU NEED INSTALLED FIRST
============================================================

Before anything else, make sure these are on your machine:

1. Git
   https://git-scm.com/downloads
   Verify: git --version

2. Docker Desktop
   https://www.docker.com/products/docker-desktop/
   Verify: docker --version
   IMPORTANT: Start Docker Desktop before doing anything else.
   It must be running in the background.

3. Node.js 20 LTS (for the frontend)
   https://nodejs.org/en (pick LTS version)
   Verify: node --version  → should say v20.x.x
           npm --version

4. Python 3.12 (for running Alembic migrations locally)
   https://www.python.org/downloads/
   Verify: python --version → should say 3.12.x

NOTE: You do NOT need to install Postgres, Redis, or MinIO
on your machine. Docker handles all of that.

============================================================
SECTION 2 — CLONE THE REPOSITORY
============================================================

Open a terminal (PowerShell or Command Prompt on Windows,
Terminal on Mac/Linux) and run:

  git clone https://github.com/cybersigmaNC/security-platform.git
  cd security-platform

You should now see these folders:
  backend/
  frontend/
  docs/
  infra/
  docker-compose.yml
  .gitignore
  README.md

============================================================
SECTION 3 — GET THE SECRET ENV FILES FROM SATHISH
============================================================

You need two .env files that are NOT in Git (for security).
Ask Sathish to send these to you directly via WhatsApp or Slack.

FILE 1: backend/.env
  Contents look like this:
  -----------------------------------------------
  DATABASE_URL=postgresql://admin:secret@postgres:5432/mydb
  REDIS_URL=redis://redis:6379
  JWT_SECRET=<sathish will give you this>
  MINIO_USER=minioadmin
  MINIO_PASSWORD=minioadmin
  ANTHROPIC_API_KEY=<sathish will give you this>
  -----------------------------------------------

FILE 2: frontend/.env.local
  Contents look like this:
  -----------------------------------------------
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=<sathish will give you this>
  -----------------------------------------------

Save these files in the correct locations:
  security-platform/backend/.env
  security-platform/frontend/.env.local

NEVER commit these files to Git. They are already in .gitignore.

============================================================
SECTION 4 — START THE BACKEND (Docker)
============================================================

The entire backend runs inside Docker. You do not need to
install Python packages manually for the backend to run.

Step 1: Open a terminal and go to the project root:

  cd security-platform

Step 2: Build and start all backend services:

  docker compose up -d --build

This will start 6 containers:
  postgres   — database on port 5432
  redis      — cache + queue on port 6379
  minio      — file storage on port 9000/9001
  backend    — FastAPI API on port 8000
  worker     — Celery task worker
  flower     — Celery monitor UI on port 5555

Step 3: Check all containers are running:

  docker compose ps

You should see STATUS = "Up" or "healthy" for all 6.
If any show "Exit" or "Error", see TROUBLESHOOTING below.

Step 4: Check the backend is working:

  Open your browser and go to:
  http://localhost:8000/health

  You should see:
  {"status":"ok","version":"0.1.0","db_ok":true}

  If db_ok is true — backend is fully working.

Step 5: Check the API docs (optional but useful):

  http://localhost:8000/docs

  This shows all available API endpoints with a test UI.

============================================================
SECTION 5 — RUN DATABASE MIGRATIONS
============================================================

The database tables need to be created once.
This step uses Python locally (not Docker).

Step 1: Go into the backend folder:

  cd backend

Step 2: Create a Python virtual environment:

  python -m venv .venv

Step 3: Activate it:

  Windows (PowerShell):
    .venv\Scripts\Activate.ps1

  Windows (Command Prompt):
    .venv\Scripts\activate.bat

  Mac/Linux:
    source .venv/bin/activate

  Your prompt should now show (.venv) at the start.

Step 4: Install Python packages:

  pip install -r requirements.txt

Step 5: Run the migration to create all 5 tables:

  alembic upgrade head

  Expected output:
    INFO  [alembic.runtime.migration] Running upgrade -> xxxx, initial schema

Step 6: Seed test users into the database:

  python app/seed.py

  Expected output:
    Seeded successfully:
      Org    : SigmaSec (slug=SS)
      Admin  : admin@sigmasec.com / Admin@12345!
      Analyst: analyst@sigmasec.com / Analyst@12345!

Step 7: Go back to the project root:

  cd ..

============================================================
SECTION 6 — TEST THE BACKEND LOGIN
============================================================

Open PowerShell and run this to confirm login works:

  Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8000/auth/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin@sigmasec.com&password=Admin@12345!"

You should see a response with access_token.
If you see "Incorrect email or password" — run Section 5
Step 6 again (seed script).

============================================================
SECTION 7 — START THE FRONTEND
============================================================

Step 1: Go into the frontend folder:

  cd frontend

Step 2: Install Node.js packages:

  npm install

  This takes 1–2 minutes the first time.

Step 3: Start the development server:

  npm run dev

  Expected output:
    ▲ Next.js 15.x.x
    - Local: http://localhost:3000
    - Ready in 2.1s

Step 4: Open your browser:

  http://localhost:3000

  You should see the SigmaSec login page.

Step 5: Log in with:

  Email:    admin@sigmasec.com
  Password: Admin@12345!

  You should land on the Dashboard page.

============================================================
SECTION 8 — VERIFY END TO END FLOW
============================================================

Do these steps in order to confirm everything is connected:

1. Open http://localhost:3000
   → Login page loads

2. Login with admin@sigmasec.com / Admin@12345!
   → Redirects to /dashboard

3. Open http://localhost:8000/docs in a new tab
   → Swagger UI shows all API endpoints

4. In Swagger UI, click POST /scans → Try it out
   → Enter: {"target": "https://example.com", "scan_types": ["vuln"]}
   → Click Execute
   → You get back a scan_id with status "queued"

5. Check the scan processed:
   → Go to http://localhost:5555 (Flower — Celery monitor)
   → You should see the task listed as SUCCESS

6. Back in the app at http://localhost:3000/scans
   → The scan should appear in the list

If all 6 steps work — you are fully set up end to end.

============================================================
SECTION 9 — DAILY WORKFLOW (after first setup)
============================================================

Every time you come back to work:

Step 1: Start Docker (if not already running):

  docker compose up -d

Step 2: Start the frontend:

  cd frontend
  npm run dev

Step 3: Open browser:

  Frontend:  http://localhost:3000
  API docs:  http://localhost:8000/docs
  Flower:    http://localhost:5555

To stop everything at end of day:

  Ctrl+C   → stops npm run dev

  docker compose down   → stops all backend containers

============================================================
SECTION 10 — USEFUL COMMANDS
============================================================

See all running containers:
  docker compose ps

See backend logs (if something is broken):
  docker logs backend --tail=50

See worker logs:
  docker logs worker --tail=50

Restart just the backend:
  docker compose restart backend

Rebuild backend after code changes:
  docker compose build --no-cache backend
  docker compose up -d

Stop all containers:
  docker compose down

Wipe database and start fresh (DANGER — deletes all data):
  docker compose down -v
  docker compose up -d
  cd backend
  source .venv/bin/activate  (or .venv\Scripts\activate on Windows)
  alembic upgrade head
  python app/seed.py
  cd ..

Pull latest code from Sathish:
  git pull origin main

============================================================
SECTION 11 — API ENDPOINTS AVAILABLE (Days 1–10)
============================================================

METHOD  ENDPOINT                    WHO CAN CALL     WHAT IT DOES
------  --------------------------  ---------------  --------------------------------
GET     /health                     anyone           Check if backend + DB is alive
POST    /auth/token                 anyone           Login — returns JWT token
GET     /auth/me                    logged in        Get current user profile
POST    /orgs                       admin only       Create a new organisation
GET     /orgs                       admin only       List all organisations
POST    /users                      admin only       Create a new user
GET     /users                      admin+analyst    List users in current org
POST    /scans                      admin+analyst    Create a scan + queue task
GET     /scans                      all roles        List scans for current org
GET     /scans/{id}                 all roles        Get single scan details
GET     /scans/{id}/progress        all roles        Live progress from Redis
GET     /scans/{id}/findings        all roles        Findings for scan (empty until Week 3)

TEST CREDENTIALS:
  Admin:   admin@sigmasec.com    / Admin@12345!
  Analyst: analyst@sigmasec.com  / Analyst@12345!

============================================================
SECTION 12 — WHAT THE FRONTEND NEEDS TO DO (your tasks)
============================================================

All frontend routes, UI modules, and backend API connections are **100% complete**:

DONE:
  POST /auth/token          →  LoginForm authentication flow
  GET  /auth/me             →  TopBar user profile dropdown
  POST /scans               →  NewScanDialog execution triggers
  GET  /scans               →  ScansListPage table registry
  GET  /scans/{id}          →  ScanDetail detailed findings audit
  GET  /scans/{id}/progress →  Live progress tracking (SSE with fallback polling)
  GET  /scans/{id}/findings →  Unified findings catalogs
  GET  /health              →  TopBar roundtrip network latency (Features 1 & 2)
  GET  /scans (Active)      →  TopBar background active scan ticker & queue counts (Feature 3)
  /dashboard                →  KPI posture widgets & trend line charts
  /findings                 →  Global sortable & filterable findings repository
  /assets                   →  Asset risk scoring configurations & lifecycle drawers
  /reports                  →  Reports dashboard (Executive, Technical, and Compliance templates with JSON/CSV/PDF exports)
  /settings                 →  Settings console (API tokens, Org Info, notifications)
  /help                     →  Onboarding documentation & support portal


============================================================
SECTION 13 — TROUBLESHOOTING
============================================================

PROBLEM: docker compose up -d fails
  FIX: Make sure Docker Desktop is open and running first.
       Look at the error message and check which container failed:
       docker logs <container_name> --tail=30

PROBLEM: http://localhost:8000/health shows db_ok: false
  FIX: Postgres isn't ready yet. Wait 10 seconds and refresh.
       If still false: docker compose restart postgres

PROBLEM: alembic upgrade head fails with "no module named app"
  FIX: Make sure you are inside the backend/ folder
       and your .venv is activated (you see (.venv) in prompt)

PROBLEM: python app/seed.py says "Already seeded — skipping"
  FIX: That is fine. It means the data is already there.
       Try logging in — it should work.

PROBLEM: Login returns "Incorrect email or password"
  FIX: Run: python app/seed.py
       If it says "Already seeded", the password hash may be wrong.
       Run this to clear and re-seed:
         docker exec -it postgres psql -U admin mydb -c "DELETE FROM users; DELETE FROM orgs;"
         python app/seed.py

PROBLEM: npm install fails
  FIX: Make sure Node.js 20 is installed: node --version
       Delete node_modules and try again:
         rm -rf node_modules
         npm install

PROBLEM: Frontend shows blank page or auth error
  FIX: Check frontend/.env.local exists with correct values.
       Check the backend is running: http://localhost:8000/health
       Check NEXTAUTH_SECRET is set in .env.local

PROBLEM: Port 8000 already in use
  FIX: Something else is using port 8000.
       Find and stop it, or change the port in docker-compose.yml.
       Windows: netstat -ano | findstr :8000
       Mac/Linux: lsof -i :8000

PROBLEM: Flower (port 5555) shows no tasks
  FIX: Make sure the worker container is running:
       docker compose ps
       docker logs worker --tail=20

PROBLEM: AI Client fails to communicate with local Ollama service (Connection Refused)
  FIX: 1. Make sure the Ollama application is running on your Windows host.
       2. Start it by searching for Ollama in your start menu or running `ollama serve` in a terminal.
       3. Open http://localhost:11434 in a browser to check if it says "Ollama is running".
       4. Pull the target model if you haven't already: `ollama pull llama3`.

============================================================
SECTION 14 — FOLDER STRUCTURE OVERVIEW
============================================================

security-platform/
├── docker-compose.yml        ← starts all 6 backend containers
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env                  ← SECRET — get from Sathish
│   ├── requirements.txt      ← Python packages
│   ├── Dockerfile.dev        ← Docker image for backend + worker
│   ├── alembic.ini           ← migration config
│   ├── alembic/
│   │   ├── env.py            ← connects Alembic to Postgres
│   │   └── versions/         ← migration files (auto-generated)
│   └── app/
│       ├── main.py           ← FastAPI app, registers all routers
│       ├── database.py       ← DB engine, SessionLocal, get_db()
│       ├── celery_app.py     ← Celery config
│       ├── seed.py           ← creates test org + users
│       ├── models/           ← 5 SQLAlchemy tables
│       │   ├── org.py
│       │   ├── user.py
│       │   ├── asset.py
│       │   ├── scan.py
│       │   └── finding.py
│       ├── auth/
│       │   ├── jwt.py        ← create + verify JWT tokens
│       │   └── dependencies.py ← get_current_user, require_role()
│       ├── routers/
│       │   ├── auth.py       ← POST /auth/token, GET /auth/me
│       │   ├── orgs.py       ← POST /orgs, GET /orgs
│       │   ├── users.py      ← POST /users, GET /users
│       │   └── scans.py      ← POST/GET /scans + progress + findings
│       ├── schemas/          ← Pydantic request/response models
│       │   ├── auth.py
│       │   ├── org.py
│       │   ├── user.py
│       │   ├── scan.py
│       │   └── finding.py
│       └── tasks/
│           └── scan_tasks.py ← Celery task (stub — real scanners Week 3)
│
└── frontend/
    ├── .env.local            ← SECRET — get from Sathish
    ├── package.json
    ├── app/
    │   ├── layout.tsx        ← root layout, fonts, theme
    │   ├── (auth)/login/     ← login page
    │   ├── (app)/
    │   │   ├── layout.tsx    ← sidebar + topbar shell with live telemetry status panel
    │   │   ├── dashboard/    ← posturalTimeline trend charts and KPI counters
    │   │   ├── scans/        ← scan execution logs and SSE progress bars
    │   │   ├── findings/     ← unified enriched vulnerabilities registry
    │   │   ├── assets/       ← dynamic risk scoring assets console
    │   │   ├── reports/      ← security reports suite (Executive, Technical, Compliance)
    │   │   ├── settings/     ← unified configuration tabs console
    │   │   └── help/         ← onboarding documentation and FAQ search portal
    │   └── api/auth/         ← Auth.js route handler
    ├── lib/
    │   └── api.ts            ← fetch wrapper with JWT header
    └── middleware.ts         ← route protection

============================================================

Questions? Ping Sathish on WhatsApp or Slack.
Check API docs at http://localhost:8000/docs anytime.

============================================================
END OF GUIDE
============================================================
