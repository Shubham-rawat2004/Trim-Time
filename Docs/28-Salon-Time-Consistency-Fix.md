# Existing-feature fix 7: Salon-time consistency and appointment instants

All current-date, current-time, and local-to-instant decisions in booking and availability now use the salon's IANA timezone through one shared `SalonTime` component.

## What changed

- Availability week defaults and special-date past checks use the barber's salon-local date.
- Appointment protection compares unfinished appointments with the salon-local current time, so schedule and qualification edits do not depend on the application server timezone.
- Slot generation converts local start and end boundaries to UTC instants and returns those instants with the salon timezone.
- Booking repeats the conversion inside the locked transaction and stores local wall times, UTC start/end instants, and the salon-timezone snapshot.
- A salon timezone cannot change while a confirmed or in-progress future appointment remains, preventing existing local schedules from being reinterpreted.
- A local boundary must have exactly one valid timezone offset. Daylight-saving gaps have none and overlaps have two, so those candidates are omitted and direct booking requests are rejected with HTTP 400.
- Date validation annotations tied to the JVM clock were removed where the service must apply salon-local rules.

## Migration and legacy records

Migration V18 adds nullable `start_instant`, `end_instant`, and `salon_timezone` columns to appointments. Every new appointment fills them.

Existing appointment rows retain their original local date/time fields and receive nulls for the new fields. The migration deliberately does not infer historical instants: a salon timezone may have changed since a booking was created, and daylight-saving overlaps cannot be reconstructed from wall time alone. A later reconciliation tool may backfill a legacy row only when an authoritative historical timezone is available.

## API behavior

Slot and appointment responses retain local `date`, `startTime`, and `endTime` fields for salon display. They additionally expose `startInstant`, `endInstant`, and `timezone`. The React UI labels displayed wall times with that timezone when present.

## Verification

`SlotTimeHandlingIT` verifies:

- UTC instant and timezone persistence for a normal Asia/Kolkata booking.
- Appointment edit protection under a test clock whose JVM date differs from the booked salon date.
- Rejection and rollback of timezone changes that would reinterpret a future appointment.
- Availability defaults and special-date validation when an America/Adak salon is still on the previous local day.
- Omission and direct-booking rejection for the America/New_York spring gap and autumn overlap.

Verification on 23 September 2026: backend unit tests passed, and `mvn -Pintegration verify` passed 45 MySQL integration tests. Frontend tests, lint, and production build passed.

## Remaining product decision

This fix does not choose slot-start granularity. Starts still advance by the combined appointment duration; the product must decide whether to use 15-minute, 30-minute, or owner-configurable increments.
