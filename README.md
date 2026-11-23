![Task Plus](brand/logo.png)

Assign recurring tasks to the people in an organization and see how they get done.

| Part | Who uses it | Stack | Folder |
| --- | --- | --- | --- |
| Web workspace | Owner and supervisors | React + TypeScript + Vite, SWAAR UI | `web/` |
| Employee app | Employees | React Native + TypeScript + Expo (Expo Router) | `mobile/` |
| API | Both apps | FastAPI + SQLAlchemy + Alembic | `backend/` |
| Database | — | PostgreSQL 17 (Docker) | — |

The web app uses `SWAAR-UI/tokens.css`, `components.css` and the Inter font, copied into `web/src/ui/` as the design system's README describes. The mobile theme (`mobile/src/lib/theme.ts`) maps `SWAAR-UI/tokens.json` to React Native styles.

## How it works

- **Organizations.** Anyone can create an organization from the web sign-up page and becomes its **owner**. An organization has exactly one owner (enforced in the database).
- **People.** The owner adds **supervisors** and **employees**; supervisors can add employees. Each person signs in with an email *or* a phone number and a password set by their manager. People are deactivated, never deleted, so history stays intact.
- **Roles.** Job roles such as Barista or Kitchen. A person can have several roles.
- **Tasks.** Only the title is required. Everything else is optional:
  - *Assign to*: all employees, one role (everyone in it), or one person.
  - *Repeat*: one time (optional due date), every day, once a week (any day Monday–Sunday), or specific weekdays.
  - *Time window*: start and/or end time, for example 09:00–11:00. Completing after the end time counts as late.
  - *Active dates*: start and end dates. Tasks can also be paused.
- **Completions.** Each person ticks off their own occurrence. Daily and weekday tasks can be completed on the day itself, weekly tasks any day of that week, and one-time tasks until done. Undo works while the day (or week) is still open.
- **Reports.** Statuses are *done*, *done late*, *missed* (the day passed), *overdue* (today, past the end time) and *open*. Completion rate = done (including late) ÷ closed. Supervisors see a live Today board, a team report by person and by task, and a report per person. Employees see their own report in the app.
- **Timezones.** Every organization has a timezone; days, weeks and time windows follow it.

Occurrences are computed from the task rules when they are needed (`backend/app/scheduling.py`), and only completions are stored. There is no background job to run.

## Local development

You need Python 3.12+, Node 22+, and Docker Desktop. Only PostgreSQL runs in Docker; the API and apps run natively with hot reload. You don't need to rebuild containers to run the apps.

```bash
make setup      # once: Python venv + npm installs
make db         # once: starts PostgreSQL in Docker and leaves it running
make migrate    # apply migrations
make seed       # optional: demo organization with three weeks of history
```

Then, in separate terminals:

```bash
make api        # http://localhost:8000/api/docs
make web        # http://localhost:5173
make mobile     # Expo: scan the QR code with Expo Go, or press w for web
```

Demo sign-ins after `make seed` are listed at the top of `backend/app/seed.py`.

**Phones on your network.** In development the app calls the API at the address of the computer running Expo, on port 8000, so start the API with `make api` (it listens on all interfaces). To use another server, create `mobile/.env.local` with `EXPO_PUBLIC_API_URL=https://tasks.example.com`.

**Tests and checks**

```bash
make test       # backend: scheduling rules + API tests (uses the taskplus_test database)
make check      # also builds and lints the web app and type-checks/lints the mobile app
```

The test database `taskplus_test` is created automatically the first time the dev PostgreSQL volume is created.

**Migrations.** After changing `backend/app/models.py`:

```bash
cd backend && .venv/bin/alembic revision --autogenerate -m "describe the change"
make migrate
```

## Deployment with Docker

`docker-compose.yml` runs PostgreSQL, the API (which applies migrations on start) and nginx serving the web app. nginx proxies `/api` to the API, so the site and the API share one origin.

```bash
cp .env.example .env    # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up -d --build
```

Put HTTPS in front of it (for example a load balancer or Caddy) and build the mobile app with `EXPO_PUBLIC_API_URL` pointing at that host. Mobile store builds use EAS (`npx eas-cli@latest build`).

## Project layout

```
brand/                 logo source; `npm run build` regenerates every logo and app icon file (see brand/README.md)
backend/
  app/models.py        tables
  app/scheduling.py    turns schedules into occurrences (pure, unit-tested)
  app/services.py      checklists, board, reports, completing tasks
  app/routers/         auth, organization, members, roles, tasks, me (employee), reports
  alembic/             migrations
  tests/
web/src/
  pages/               Today, Tasks, Task form, Roles, People, Reports, Settings
  components/          app shell, SWAAR-based UI helpers, report charts
  ui/                  SWAAR UI tokens, components and font
mobile/src/
  app/                 Expo Router screens: sign-in, (tabs)/index, report, profile
  components/ lib/
```
