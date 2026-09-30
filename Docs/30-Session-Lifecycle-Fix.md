# Existing-feature fix 9: Authentication and session lifecycle

Session authentication now rotates identity at sign-in and continuously derives authorization from current database state.

## What changed

- Registration and login rotate an existing HTTP session ID before storing the authenticated user.
- Sessions store `trimtime.userId` and the account's current `authorization_version`.
- Every protected request reloads the account and current role set from MySQL before Spring Security authorization runs.
- A changed authorization version refreshes the session marker and authorities in the same request.
- Adding or removing a role increments `authorization_version` only when the role set actually changes.
- Inactive or missing accounts immediately invalidate their existing session and clear the security context.
- Logout invalidates the session and clears the security context.
- Sessions expire after 30 idle minutes and are stored in backend memory, so a backend restart signs users out.

## Why refresh instead of forcing sign-in after a role change

Salon creation and approved barber onboarding legitimately add a role while the user may already be signed in. Refreshing from current database state makes that change visible without weakening revocation: removed roles disappear before method authorization on the next request. Account deactivation remains a hard session invalidation.

Object-level checks still query current salon ownership and barber membership inside their service operations. The authorization version does not replace those checks.

## Cookie and deployment boundary

The application uses an HttpOnly SameSite=Lax session cookie and CSRF tokens for state-changing requests. Local development uses HTTP, so the cookie is not marked `Secure`; production HTTPS configuration must enable that flag. Persistent or distributed sessions are outside the current single-backend design.

## Verification

`IdentitySessionIT` runs against MySQL and verifies:

- Authentication changes a pre-existing session ID.
- The authenticated session stores the user ID and authorization version.
- Logout invalidates the session and subsequent anonymous access is denied.
- Adding BARBER increments the account version and refreshes the same session's authorities.
- Deactivating the account immediately invalidates its existing session.

No schema migration is required because `authorization_version` has existed since V2. Login throttling remains a separate security-control gap.

Verification on 24 September 2026: backend unit tests passed, and `mvn -Pintegration verify` passed 49 MySQL integration tests. The existing frontend 7-test suite, lint, and production build remain green.
