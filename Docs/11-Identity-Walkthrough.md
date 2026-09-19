# Milestone 2: Identity and customer access

## What this feature does

Feature 1/12 now supports customer registration, login, logout infrastructure, and a current-user endpoint. Every newly registered account receives CUSTOMER. Passwords are stored as BCrypt hashes, never returned by the API, and the authenticated browser uses an HttpOnly session cookie. CSRF protection is enabled; the frontend obtains a CSRF token before state-changing authentication requests.

Role-based onboarding is next: salon creation grants SALON_OWNER, while barber self-registration creates a join request that the salon owner must approve. Those roles are not granted by client-submitted role names.

## API behavior

| Request | Purpose |
| --- | --- |
| GET `/api/auth/csrf` | Gets a CSRF token and sets the token cookie. |
| POST `/api/auth/register` | Creates a CUSTOMER account; returns 201. |
| POST `/api/auth/login` | Verifies credentials and starts a session. |
| GET `/api/auth/me` | Returns the current account; requires the session. |
| POST `/api/auth/logout` | Invalidates the session; requires a valid CSRF token. |

Duplicate email returns 409. Invalid credentials return 401. Protected endpoints without a session are rejected. The email is normalized to lowercase before uniqueness checks.

## Manual test

Open the running application at http://localhost:8088. In the Feature 01 card:

1. Register with a display name, email, and password of at least eight characters.
2. Confirm that the card changes to Signed in and shows CUSTOMER.
3. Use a new browser/private window to try the same email; the server should reject it as a duplicate.
4. Switch to Log in and use the registered credentials. An incorrect password should show an error.
5. For direct API checks, use the existing PowerShell session pattern in the root README or inspect requests in the browser developer tools. Do not log real passwords or tokens.

## Automated verification

- Backend `mvn verify`: compiles the identity module and passes the foundation unit tests.
- Backend `mvn -Pintegration verify`: runs Flyway and the real-MySQL HTTP foundation test. Run it after every migration change.
- Frontend `npm test`: covers foundation states and the registration form using a mocked API.
- Frontend `npm run build` and `npm run lint`: required before the milestone is considered complete.

## Design choices

- Modular monolith: identity is a backend module, not a separate service.
- Session authentication is suitable for this same-origin browser app and keeps the frontend free from token storage.
- Multiple roles remain a database relationship, so BARBER and SALON_OWNER can be added without duplicating accounts.
- The API returns DTOs rather than JPA entities and never exposes `password_hash`.

## Next milestone

Salon setup and owner access: create exactly one salon per owner, add owner-scoped profile data, and test that another account cannot edit it. Then implement barber profile and owner-approved join requests.
