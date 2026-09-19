# Milestone 1: Project foundation

## What it does

The React page requests GET /api/system/status. Spring Boot queries a marker created by Flyway in MySQL and returns CONNECTED only if that query succeeds. The page displays a clear failure state and retry button when the backend/database is unavailable. This is a development checkpoint, not a booking feature.

## Files to understand

| File | Responsibility |
| --- | --- |
| ../backend/pom.xml | Java dependencies, compilation target, test profile |
| ../backend/src/main/java/com/trimtime/TrimTimeApplication.java | Spring Boot entry point |
| ../backend/src/main/java/com/trimtime/system/SystemStatusController.java | HTTP endpoint and database verification |
| ../backend/src/main/resources/application.properties | Database, Flyway, JPA, and operational settings |
| ../backend/src/main/resources/db/migration/V1__foundation.sql | Initial database marker and installation time |
| ../frontend/src/App.tsx | Connection-check UI and request lifecycle |
| ../frontend/vite.config.ts | Local frontend-to-backend proxy |
| ../compose.yaml | MySQL, backend, frontend, private network, named volumes |
| ../scripts/start-backend.ps1 | Loads local configuration and starts the backend |

No domain entities/repositories exist yet because identity is the next feature. The foundation uses a direct read-only JDBC query; domain features will use entities, repositories, DTOs, services, and controllers. Spring Security/registration/role authorization are not implemented or claimed complete at this stage.

## Manual acceptance checklist (after Docker is working)

1. Follow the README startup steps; open the frontend and expect **Connection verified**.
2. Open http://localhost:8080/api/system/status and expect HTTP 200 with status UP and database CONNECTED.
3. Stop the backend, click Check connection, and expect Connection unavailable. Restart and retry to recover.
4. Run the MySQL integration tests with `mvnw.cmd -Pintegration verify` from backend. They verify migration and the real HTTP endpoint using an isolated MySQL container.
5. Run `docker compose up --build -d` and verify the same connection through http://localhost:8088.
6. Inspect the initial timestamp using the command below, run `docker compose down`, then `docker compose up -d`. Repeat the query and confirm the timestamp is unchanged. Never use `down -v` for this check.

```powershell
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT * FROM application_metadata;"'
```

## Verification status

- Backend unit tests: 2 passed; Maven package/verify succeeded using local JDK 23 with Java 21 release target.
- Frontend tests: 3 passed, covering successful status, failure/retry, and unhealthy response.
- TypeScript/production build and lint: passed.
- Docker Compose configuration: validated without printing secrets.
- Real MySQL integration, complete container startup, and persistence check: passed after Docker became available. The integration test uses an isolated MySQL container; the Compose stack uses the persistent named volume.

## Environment blocker

Docker Desktop is installed, but its Linux engine is unavailable. Its startup log reports an inaccessible internal `dockerInference` socket under the user's AppData/Local/Docker/run directory. Starting Desktop did not recover the engine. A rename attempt failed and did not change the file. Existing MySQL80 is running separately; this project has not altered that service or its data.

Open Docker Desktop and use its normal troubleshooting/restart flow; a Windows restart may release the stale socket. Avoid factory reset or data deletion. Resume the runtime checks once `docker info` reports a server. This milestone remains **implemented, partially verified**, not fully complete.

## Next milestone

Registration/login with password hashing, sessions, CSRF protection, request DTOs, validation, and CUSTOMER access. Then salon setup and owner-approved barber onboarding. Booking policy proposals remain undecided.
