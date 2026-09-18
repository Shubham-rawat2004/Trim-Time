# Trim-Time: Booking Consistency and Availability Design

The filename follows the reference screenshot. There is no external synchronization engine in this project. This document defines how availability, booking writes, schedule edits, and frontend refreshes remain consistent.

Status: proposed implementation protocol requiring integration tests against MySQL.

## Finalized onboarding consistency requirements

Barber self-registration creates a profile/request, not salon access. The selected salon owner approves or rejects. Approval must atomically update request state, active membership, BARBER role, and authorization version. One pending request and one active membership per applicant are enforced even under concurrent requests. Owner self-enrollment follows the same membership checks without a join request.

Proposed combined lock order: salon, affected user rows in ascending ID order when role/membership changes are involved, then barber membership rows in ascending ID order. Booking operations may skip user locks because they do not modify membership, but must not acquire a user lock after a barber lock. All paths re-read membership under their relevant locks. Request submission, withdrawal, rejection, and approval recheck current state; terminal requests cannot be approved later.

Salon setup creates the salon and SALON_OWNER access atomically; a unique owner key prevents concurrent creation of a second salon. Onboarding and membership writes require dedicated MySQL race tests in addition to booking tests below.

## Source of truth

MySQL is authoritative. A slot shown in React is a candidate, not a reservation. Availability is recomputed and revalidated during booking. Polling, WebSockets, caches, and distributed locks are unnecessary for the MVP.

## Candidate slots

1. Validate salon, selected items, compatible add-ons, and a requested local date.
2. Find active barbers supporting every selected item.
3. Intersect salon and barber working intervals.
4. Subtract breaks, days off, and blocking appointments.
5. Generate starts using the agreed slot-start increment.
6. Keep only intervals fitting the full combined duration and future-booking rules.
7. Return explicit instants, display zone, duration, and server-derived price information.

Slot increment and advance-booking limits remain open. Handle ambiguous or nonexistent daylight-saving local times explicitly; never silently assign an arbitrary offset.

## MySQL locking protocol

Proposed lock order for booking and availability-affecting operations:

1. Lock salon row, then affected barber rows in ascending ID order.
2. Read authoritative service, schedule, and appointment data after locks are obtained.
3. Validate the operation and apply writes within the same transaction.
4. Commit; release locks.

The initial salon lock is deliberately conservative: writes within one salon serialize. It simplifies consistency between bookings, service edits, salon-hour edits, and staff changes for this project's expected scale. Optimization to narrower locking is a later engineering decision, not an MVP requirement.

Every writer of salon availability or booked service inputs must follow the same salon-first protocol, including catalogue edits, schedule changes, cancellations, and staff deactivation. Locking only a booking row does not protect an empty time interval.

## Booking transaction

- Authenticate customer and validate input structure.
- Begin a transaction using the chosen tested isolation level; acquire salon/barber locks.
- Resolve a client-generated request key: return the existing result for an identical completed request; reject reuse with different content.
- Re-read active salon/barber, qualifications, selected services, price, duration, schedule, and policy.
- Test overlap: existing.start < requested.end AND existing.end > requested.start.
- Proposed rule: all non-cancelled bookings retain their occupied interval; only future candidate slots are offered.
- Insert booking, immutable item snapshots, initial history event, and successful request-key record atomically.
- Return confirmation after commit. On conflict, return 409 and fresh-availability guidance.

If a request commits but its response is lost, retrying with the same key returns the same booking. The same-key check is performed inside the serialized transaction and backed by a unique constraint.

## Schedule and service changes

- Reject hours, breaks, days off, staff removal, or qualification changes that invalidate future confirmed appointments.
- Explain the conflicting appointments; do not silently cancel or move them.
- Service price and duration changes apply to future bookings only; existing snapshots and end times stay unchanged.
- Salon-wide changes use the same salon lock and then deterministic barber ordering if needed.

## Cancellation and status

- Acquire shared protocol locks, re-read current status, and evaluate policy using server time.
- Write status and history atomically.
- Repeated cancellation of an already cancelled booking may return its current result without another history event.
- Reject incompatible terminal transitions.
- No financial refund or deduction is executed.

## Frontend synchronization

Refresh relevant availability and history after successful mutations. Do not optimistically present an unconfirmed booking as successful. Preserve user selections on conflicts, and prevent repeated submission visually while keeping server-side retry protection.

## Failure handling and acceptance

- Roll back all booking writes on error.
- Use bounded lock waits and controlled responses for deadlocks/timeouts; do not retry indefinitely.
- Verify overlapping concurrent requests, different barbers, back-to-back intervals, retry-after-lost-response, and booking versus schedule-edit races.
- Verify that container/backend restart cannot create partial committed booking data.
