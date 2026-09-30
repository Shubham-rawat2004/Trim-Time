# Feature 11: Appointment Cancellation Walkthrough

Trim-Time now allows customers and salon owners to cancel confirmed appointments and immediately frees the booking interval.

## What is included

- **Customer self-cancellation**: Customers can cancel their own `CONFIRMED` appointment from their appointment list or via `POST /api/appointments/{bookingReference}/cancel`.
- **Salon owner cancellation**: Salon owners can cancel an appointment at their salon via `POST /api/salons/mine/appointments/{bookingReference}/cancel`.
- **Immediate slot release**: Once cancelled, the appointment status transitions to `CANCELLED`, which removes it from blocking status filters (`CONFIRMED`, `IN_PROGRESS`). The slot immediately becomes bookable again.
- **Pessimistic concurrency lock**: Cancellation acquires the salon row write lock (`BookingWriteLock.salon()`) in `READ COMMITTED` transactions, ensuring that concurrent booking requests, schedule edits, or break changes serialize properly.
- **Terminal state protection**: Repeated cancellation attempts return `409 Conflict` (`AppointmentAlreadyCancelledException`). Completed or no-show appointments cannot be cancelled.
- **Past appointment protection**: Appointments that have already started or ended in the salon timezone cannot be cancelled (`400 Bad Request`).
- **Authorization boundaries**: Non-owners cannot cancel someone else's appointment (`403 Forbidden`).

## API surface

- `POST /api/appointments/{bookingReference}/cancel` (Customer)
- `POST /api/salons/mine/appointments/{bookingReference}/cancel` (Salon Owner)

## Verification

- `BookingConsistencyIT` tests:
  - Customer cancelling a confirmed booking and verifying slot is freed and bookable again.
  - Rejecting cancellation by unauthorized users.
  - Rejecting repeat cancellation attempts on already cancelled bookings.
  - Salon owner cancellation at their owned salon.
- Frontend Vitest (`App.test.tsx`) verifies:
  - Customer appointment card displays `Cancel appointment` button for `CONFIRMED` bookings.
  - Clicking `Cancel appointment` sends CSRF token, transitions status to `CANCELLED`, and hides the cancel button.
