# Existing-feature fix 2: One pending barber application

An applicant may now have only one PENDING request across all salons. Submission checks the applicant globally and returns HTTP 409 with an explanation if another pending request exists. The frontend displays that explanation.

## Concurrency and database enforcement

Application submission and owner approval/rejection use READ COMMITTED transactions and acquire locks in salon-then-applicant order. The applicant row serializes submissions to different salons, as well as an approval racing with a new application. Decision handlers read request state and roles after locking; a repeated or competing terminal decision returns a conflict instead of overwriting the winner.

Migration V15 adds a nullable generated `pending_barber_user_id` and a unique constraint. It contains the applicant ID only while status is PENDING. MySQL therefore independently enforces the rule while allowing multiple historical terminal requests. Rejection releases the pending slot; approval creates membership and BARBER access atomically, preserving CUSTOMER access. Existing membership still prevents a new application.

## Existing data

V15 does not silently reject, withdraw, or delete older requests. If a database already contains multiple pending requests for one applicant, its atomic ALTER fails and those records require explicit reconciliation before migration. Read-only preflight query:

```sql
SELECT barber_user_id, COUNT(*) AS pending_count
FROM barber_join_requests
WHERE status = 'PENDING'
GROUP BY barber_user_id
HAVING COUNT(*) > 1;
```

The local Compose database was checked before implementing V15 and had no such duplicates. Recheck any other database before upgrade.

## Verification

`BarberOnboardingIT` uses real MySQL to verify same/different-salon duplicate rejection, rejection followed by a new application, a direct database-constraint bypass attempt, simultaneous submissions, simultaneous approvals, approval versus rejection, approval versus another application, and wrong-owner decisions.

Application withdrawal and owner self-enrollment remain separate features; this fix does not add them.

Verification on 22 September 2026: all 8 onboarding integration tests passed; the combined full suite passed 23 integration tests and 2 unit tests. Frontend tests, lint, and build also passed.
