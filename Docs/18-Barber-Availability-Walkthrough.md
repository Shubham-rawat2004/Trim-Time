# Feature 06: Barber availability

Trim-Time now lets an approved barber maintain the times customers may book.

## What is included

- Week-specific hours for Monday through Sunday. The UI lets a barber select several working days and save the same hours in one action; each week is saved separately and must be configured again when the next week changes.
- Special dates that are either full-day closures or custom hours with an optional reason. Both types are allowed only when that weekday is marked as working in the selected week; an unchecked weekday is already closed and cannot receive a duplicate special-date record.
- Removal of a previously added day off.
- Server-side validation that an end time is after its start time.
- Access restricted to accounts with the `BARBER` role and an active salon membership. A registered user or pending applicant cannot manage availability.

## API surface

- `GET /api/barber/availability/hours?weekStartDate=YYYY-MM-DD`
- `PUT /api/barber/availability/hours` with `weekStartDate`, `dayOfWeek`, `startTime`, and `endTime`
- `PUT /api/barber/availability/hours/bulk` with `weekStartDate`, `daysOfWeek`, `startTime`, and `endTime`
- `GET /api/barber/availability/days-off`
- `POST /api/barber/availability/days-off` with a future or current `date`; omit `startTime` and `endTime` for a full-day closure, or provide both for custom hours
- `DELETE /api/barber/availability/days-off/{id}`

The data is stored by Flyway migration `V7__barber_availability.sql` in `barber_working_hours` and `barber_days_off`.

## UI verification

1. Register or log in as a barber account.
2. Apply to a salon and have that salon owner approve the application.
3. Log in again if needed. The account card should show `BARBER` and the **Your availability** section should be visible.
4. Choose the Monday date for the week, leave Monday through Saturday selected, enter 09:00–17:00, and click **Save weekly schedule**. All selected days should appear below the form.
5. Uncheck Sunday to leave it closed for that week. Choose another week's Monday later and configure that week separately.
6. A custom-hours special date is accepted only when its weekday is working in that date's week. An unchecked Tuesday, for example, cannot receive custom hours.
7. Add a future date as unavailable, or provide special start and end times for a working weekday. It should appear under **Special date schedules**.
8. Remove that date and confirm it disappears.
9. Try an end time before the start time or submit without selecting a day; the API should reject it and the UI should show an error.

Customers and salon owners do not see this section, and direct requests without an approved barber membership receive `403 Forbidden`.
