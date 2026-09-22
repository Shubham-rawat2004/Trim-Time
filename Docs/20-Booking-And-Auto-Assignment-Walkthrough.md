# Feature 08: Conflict-safe booking and automatic barber assignment

Trim-Time now confirms an appointment without asking the customer to choose a barber.

## What is included

- A salon-level slot list hides barber identity during selection.
- At confirmation, the backend finds approved barbers who are qualified for every selected primary service and whose individual schedule covers the complete combined service and add-on duration.
- Add-ons inherit qualification from their compatible selected primary service; they do not require a separate barber qualification in this MVP.
- Existing confirmed and in-progress appointments block overlapping assignments.
- A database transaction locks the candidate barber membership and rechecks conflicts before saving.
- The first eligible barber in the deterministic assignment order is assigned internally.
- The appointment stores a booking reference, service and add-on snapshot, duration, price, date/time, salon, and assigned barber.
- The customer sees the assigned barber name only after confirmation and can view the appointment in **Your appointments**.

## UI verification

1. Configure an approved barber and a week-specific schedule.
2. Log in as a customer and find slots for one or more active services.
3. Click **Book this time**. The response should show a booking reference, `CONFIRMED` status, and the assigned barber name.
4. Confirm the appointment appears under **Your appointments** with the selected service summary, full price, and combined duration.
5. Search the same date again. The booked barber's overlapping time should no longer be returned.
6. With multiple barbers, confirm that the same salon-level time remains available while another eligible barber can serve it.

Booking cancellation, completion, no-show transitions, and owner/barber appointment dashboards remain later features.
