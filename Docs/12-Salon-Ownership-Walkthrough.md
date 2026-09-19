# Trim-Time: Salon Ownership Walkthrough

Status: Feature 02 initial slice implemented.

## What this slice does

An authenticated account can create one salon. The salon stores its owner, basic business details, contact information, coordinates, and local timezone. The owner can retrieve the salon through `GET /api/salons/mine`. A second salon for the same owner is rejected with HTTP 409.

Creating the salon also grants the account the `SALON_OWNER` role. The account keeps its original `CUSTOMER` role, which demonstrates the approved multiple-role model. The owner relationship is enforced in the database with a unique owner key and in the service layer with a clear conflict response.

## Backend pieces

- `V3__salons.sql` creates the salon table and owner foreign key.
- `Salon` maps salon data and uses decimal coordinate columns for MySQL compatibility.
- `SalonService` enforces one salon per owner and grants the owner role.
- `SalonController` exposes create, read, and update endpoints under `/api/salons`.
- The React screen provides a small salon setup form after sign-in.

## Manual check

1. Start the full stack with `docker compose up --build -d`.
2. Open `http://localhost:8088` and register or log in.
3. Submit the salon name, address, contact, description, and timezone.
4. Confirm the created salon card appears and the account receives the owner role on the next authenticated request.
5. Submit a second create request for the same account and confirm the API returns `409`.

The API can also be checked with a session that has the CSRF token from `GET /api/auth/csrf`, followed by `POST /api/auth/login`, `POST /api/salons`, and `GET /api/salons/mine`.

## Intentionally deferred

Salon editing screens, photos, services, add-ons, discovery radius, and barber approval workflows remain later roadmap work. This slice establishes the owner and salon relationship those features depend on.
