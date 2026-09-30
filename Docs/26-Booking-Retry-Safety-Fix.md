# Existing-feature fix 5: Booking retry safety

A booking confirmation can commit even when its HTTP response never reaches the browser. Appointment creation now accepts a client-generated `Idempotency-Key`, so repeating that exact request returns the already committed appointment instead of assigning a second time.

## Server behavior

- `POST /api/appointments` requires an `Idempotency-Key` containing 1 to 100 letters, digits, dots, underscores, colons, or hyphens.
- The key is scoped to the authenticated customer. Two customers may independently use the same value.
- The server normalizes selected service and add-on IDs, then stores a SHA-256 fingerprint of the salon, selections, date, and start time.
- Booking locks the salon and then the customer row before checking the key. Concurrent retries therefore serialize even when a reused key points at different salons.
- An existing key with the same fingerprint returns the original appointment. The availability and past-time checks are deliberately skipped for this replay because the original transaction already committed.
- An existing key with a different fingerprint returns HTTP 409. Missing or malformed keys return HTTP 400.
- Migration V16 adds nullable `request_key` and `request_fingerprint` columns plus a unique `(customer_user_id, request_key)` constraint. Nullable columns preserve existing appointments without inventing historical keys.

The React booking flow creates one UUID for the exact selection and retains it after network failure. It removes the key after a confirmed response and also de-duplicates the appointment list by booking reference.

## Verification

Real-MySQL integration tests cover a normal replay, changed-payload key reuse, two simultaneous retries, and malformed keys. The frontend test loses the first appointment response and verifies that the second click sends the same key and displays the confirmed booking once.

Verification on 23 September 2026: `mvn -B -Pintegration verify` passed 2 unit tests and 35 MySQL integration tests. `npm test` passed 7 tests; lint and the production build also passed.
