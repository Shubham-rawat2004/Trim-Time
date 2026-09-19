# Trim-Time

Salon appointment booking, built step by step as a Spring Boot modular monolith with React and MySQL.

## Current milestone

Foundation, identity, salon ownership/profile editing, salon directory selection, barber onboarding, and service catalogue implemented: project scaffolds, MySQL/Flyway configuration, a real database-status endpoint, customer registration/login/session access, one-salon-per-owner creation and editing, visible salon selection with owner identity, barber applications with owner approval/rejection and membership rules, owner-managed services with price and duration, React connection/auth/salon/barber/catalogue screens, Docker/Compose/Nginx configuration, and automated tests. Add-ons, availability, booking, and cancellation features are not implemented yet.

See the [foundation walkthrough](Docs/10-Foundation-Walkthrough.md), [identity walkthrough](Docs/11-Identity-Walkthrough.md), [salon ownership walkthrough](Docs/12-Salon-Ownership-Walkthrough.md), [barber onboarding walkthrough](Docs/13-Barber-Onboarding-Walkthrough.md), [salon profile editing walkthrough](Docs/14-Salon-Profile-Editing-Walkthrough.md), [salon directory walkthrough](Docs/15-Salon-Directory-And-Selection-Walkthrough.md), and [service catalogue walkthrough](Docs/16-Service-Catalogue-Walkthrough.md) for what each component does and how to test it. The [scope document](Docs/01-MVP-Scope.md) defines the agreed 12 features.

## Requirements

- Java 21+ (target is Java 21; local compile verified with installed JDK 23).
- Node 22.19+ on the 22.x line; npm.
- Docker Desktop with its Linux engine running.
- Maven wrapper is included; installed Maven also works.

Backend: Spring Boot 4.1.1. Frontend and test versions are locked in frontend/package-lock.json. MySQL image: 8.4.8.

## Local setup (PowerShell, repository root)

1. Copy `.env.example` to `.env` if absent, and replace both password placeholders. An ignored `.env` has already been generated for this workspace with random local credentials; do not overwrite it once MySQL is initialized.
2. Start Docker Desktop and verify `docker info` succeeds.
3. Start the database:

```powershell
docker compose up -d mysql
```

4. Start the backend in another terminal:

```powershell
.\scripts\start-backend.ps1
```

5. Start the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` to the backend at the APP_PORT from `.env` (this workspace uses 8081 because 8080 was already occupied). The database uses local port 3307 to avoid interfering with an existing MySQL installation. If you change APP_PORT, also update the Vite proxy target.

## Entire application in containers

```powershell
docker compose up --build -d
docker compose ps
```

Open http://localhost:8088. Nginx serves React and forwards API requests to Spring Boot. All published ports bind to localhost for development. The Compose file is not a cloud-ready HTTPS deployment configuration.

Stop with `docker compose down`; named data volumes remain. Do not add `-v` unless you intend to erase the application's database and photo volumes. Local JDBC settings disable TLS for the local/private Compose connection only; cloud configuration must be reviewed before deployment.

## Checks

```powershell
cd backend
.\mvnw.cmd verify
.\mvnw.cmd -Pintegration verify
```

The second command requires Docker and tests an isolated real MySQL container, not the developer database. It fails rather than silently skipping when Docker is unavailable.

```powershell
cd frontend
npm test
npm run lint
npm run build
```

No cloud resources or deployment have been created. Feature implementation follows the roadmap in Docs.
