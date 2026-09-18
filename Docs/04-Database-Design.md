# Trim-Time: Database Design

Status: conceptual MySQL/InnoDB schema. Final SQL and entity mappings will be created during implementation through Flyway.

## Conventions

- Use consistent primary-key types and foreign keys; identifiers alone do not provide authorization.
- Store appointment instants in UTC with microsecond precision and a documented JDBC/session timezone configuration.
- Store local schedule times separately from dates; salons have an IANA time-zone identifier.
- Store amounts as DECIMAL with a currency code; never use floating point for prices.
- Use created_at/updated_at where relevant and version columns for stale-edit detection where useful.
- Preserve history by deactivating referenced catalogue/staff records instead of cascading deletion.

## Proposed tables

| Table | Key fields and relationships |
| --- | --- |
| users | id, normalized_email UNIQUE, password_hash, display_name, active, authorization_version, timestamps |
| user_roles | user_id FK, role; UNIQUE(user_id, role) |
| salons | id, owner_user_id NOT NULL FK UNIQUE, name, description, address, contact, latitude, longitude, timezone, active |
| salon_photos | id, salon_id FK, storage_key, content_type, size_bytes, display_order |
| salon_working_intervals | id, salon_id FK, day_of_week, local_start, local_end |
| barber_profiles | id, user_id FK UNIQUE, display_name, professional_description; exists before salon approval |
| barber_join_requests | id, profile_id FK, salon_id FK, status, submitted_at, decided_at, decided_by FK nullable; retains application history |
| barbers | id, salon_id FK, profile_id FK, active, joined_at, ended_at; a salon membership, not the global profile |
| services | id, salon_id FK, name, description, kind(BASE/ADD_ON), price, currency, duration_minutes, active |
| service_addon_compatibility | base_service_id FK, addon_service_id FK; unique pair |
| barber_services | barber_id FK, service_id FK; unique pair |
| barber_working_intervals | id, barber_id FK, day_of_week, local_start, local_end |
| barber_breaks | id, barber_id FK, day_of_week, local_start, local_end |
| barber_day_offs | id, barber_id FK, local_date; unique barber/date |
| cancellation_policy_versions | id, version UNIQUE, explicitly defined rule parameters, effective_from |
| bookings | id, reference UNIQUE, customer_id FK, salon_id FK, barber_id FK, start_at, end_at, status, total_price, currency, policy_version_id FK, created_at, version |
| booking_items | id, booking_id FK, service_id FK, service_name_snapshot, kind_snapshot, price_snapshot, duration_minutes_snapshot |
| booking_status_history | id, booking_id FK, from_status, to_status, actor_user_id FK, reason, occurred_at |
| booking_requests | customer_id FK, request_key, payload_hash, booking_id FK; unique customer/request_key |

The request-key table is a proposed reliability mechanism for safe booking retries, not a customer-facing feature. Multiple roles per account, owner-approved barber applications, and one salon per owner are finalized; exact schema implementation remains proposed.

## Integrity rules

- Booking end must be later than start; service duration must be positive; price must be nonnegative.
- Latitude must be within -90..90 and longitude within -180..180.
- Barber and selected services must belong to the booking's salon.
- The barber must support every selected item; add-ons require a compatible selected base service.
- Currency must be consistent across all booking items.
- At confirmation, totals and end time are derived from server-read service values.
- Eligibility checks spanning tables belong in a transactional service, with database constraints where practical.
- Existing booking snapshots remain unchanged when a service is renamed, repriced, or deactivated.
- Unique start time alone does not prevent overlapping variable-duration bookings.

## Finalized identity constraints and proposed enforcement

- One account has one barber profile and can have several role rows. All registered users retain CUSTOMER.
- One owner owns at most one salon, enforced by salons.owner_user_id being UNIQUE and NOT NULL. Each salon therefore has exactly one owner.
- One salon has many barber memberships; one profile has at most one active membership across all salons.
- A profile has at most one PENDING join request. Request states are PENDING, APPROVED, REJECTED, WITHDRAWN.
- Proposed MySQL enforcement: a nullable generated profile-id column populated only for PENDING requests, with a UNIQUE index. Use an equivalent active-profile generated column and UNIQUE index on barbers for active memberships. Validate exact DDL against the selected MySQL version.
- Approval atomically changes the request status, creates membership, grants BARBER, and increments authorization_version. Repeat approval returns the existing outcome, not another membership.
- Owner self-enrollment bypasses the application but uses the same membership uniqueness and authorization rules.
- Keep historical membership rows when staff leave; bookings reference their original membership. Do not overwrite an old membership's salon when a barber moves.
- Schedules and capabilities reference the salon membership, so they do not transfer silently to another salon.
- Pending/rejected requests and a profile alone grant no barber authority. Role membership is kept consistent with active salon membership.

Proposed locking for staff onboarding: acquire salon, then applicant user, then existing membership rows where relevant. Request submission/withdrawal/approval and owner self-enrollment use this order; uniqueness constraints provide an additional race safeguard. See document 06 for the combined ordering with booking locks.

## Index candidates

- bookings(barber_id, status, start_at) for overlap lookup.
- bookings(customer_id, start_at) for customer history.
- bookings(salon_id, start_at) for owner dashboards.
- barbers(salon_id, active), services(salon_id, active).
- Schedule foreign-key/day indexes and existing unique keys above.

Review query plans with representative data before adding further indexes. Both start and end conditions are required for overlap checks even if only start is indexed.

## Transactions and isolation

Use InnoDB transactions with a shared parent-row locking protocol. Lock the barber before reading conflicting appointments and writing a booking. Choose and test transaction isolation explicitly; the proposed booking transaction uses READ COMMITTED and reads authoritative rows after acquiring locks. Do not perform stale preliminary database reads and assume the lock refreshes them automatically.

See [booking consistency](06-Sync-Engine-Design.md) for salon-wide edits, lock ordering, and retry behavior.

## Retention and migration

- No payment, refund, commission, review, reward, or external GitHub tables belong in this MVP.
- Cancelled bookings remain for history; cancellation releases availability through status semantics.
- Apply migrations against empty and existing databases in tests.
- Do not use schema auto-update as the deployment migration mechanism.
- Photo removal and database metadata changes need failure handling because filesystem writes do not share a database transaction.
- Personal-data retention and account deletion policy remain open; deactivation is not equivalent to erasure.
