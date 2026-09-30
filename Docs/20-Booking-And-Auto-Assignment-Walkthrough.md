# Feature 08: Conflict-safe booking and automatic barber assignment

Trim-Time now confirms an appointment without asking the customer to choose a barber.

## What is included

- A salon-level slot list hides barber identity during selection.
- At confirmation, the backend finds approved barbers who are qualified for every selected primary service and whose individual schedule covers the complete combined service and add-on duration.
- Add-ons inherit qualification from their compatible selected primary service; they do not require a separate barber qualification in this MVP.
- Existing confirmed and in-progress appointments block overlapping assignments.
- A barber is ineligible when the requested interval overlaps any saved break for that week and weekday.
- Booking rejects starts earlier than the salon-local current time and rejects selections whose combined duration would leave the selected date.
- A READ COMMITTED transaction locks the salon before reading booking inputs, then locks eligible barber memberships in ID order and rechecks conflicts before saving. Schedule, qualification, catalogue, salon profile, and membership-approval writes share the salon lock.
- The first eligible barber in the deterministic assignment order is assigned internally.
- The appointment stores a booking reference, ordered immutable service/add-on line items, aggregate summaries, duration, price, local date/time, UTC start/end instants, salon-timezone snapshot, salon, and assigned barber.
- Each new line item retains its type, original catalogue ID, name, price, duration, and display order even after catalogue edits or deactivation.
- The customer sees the assigned barber name only after confirmation and can view the appointment in **Your appointments**.
- The browser sends an `Idempotency-Key` and retains it for the exact booking selection until confirmation. If a successful response is lost, repeating the request returns the original appointment; reusing the key for different content returns HTTP 409.

## UI verification

1. Configure an approved barber and a week-specific schedule.
2. Log in as a customer and find slots for one or more active services.
3. Click **Book this time**. The response should show a booking reference, `CONFIRMED` status, and the assigned barber name.
4. Confirm the appointment appears under **Your appointments** with the selected service summary, full price, combined duration, and individual item breakdown.
5. Search the same date again. The booked barber's overlapping time should no longer be returned.
6. With multiple barbers, confirm that the same salon-level time remains available while another eligible barber can serve it.

Booking cancellation, completion, no-show transitions, and owner/barber appointment dashboards remain later features.

See [booking consistency fix](22-Booking-Consistency-Fix.md) for edit protections, service-ID persistence, and concurrency verification. See [slot time handling fix](25-Slot-Time-Handling-Fix.md) for salon-local “now” and same-day duration checks. See [booking retry safety](26-Booking-Retry-Safety-Fix.md) for request-key behavior. See [salon-time consistency](28-Salon-Time-Consistency-Fix.md) for UTC instant persistence and daylight-saving handling. See [appointment item snapshots](29-Appointment-Item-Snapshots-Fix.md) for structured history data and the legacy-row policy.
