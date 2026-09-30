# Feature 06: Barber availability

Trim-Time now lets an approved barber maintain the times customers may book.

## What is included

- Week-specific hours for Monday through Sunday. The UI lets a barber select the complete set of working days for a week and save the same hours in one action; each week is saved separately and must be configured again when the next week changes.
- Unchecked weekdays are closed for that week. If a weekday was previously saved and is later unchecked, its saved hours and any special-date override on that date are removed together.
- Multiple non-overlapping breaks may be saved inside each working day. Breaks are week-specific, disappear when their weekday is closed, and cannot be moved outside the day by a later hours edit.
- Special dates that are either full-day closures or custom hours with an optional reason. Both types are allowed only when that weekday is marked as working in the selected week; an unchecked weekday is already closed and cannot receive a duplicate special-date record.
- Removal of a previously added day off.
- Server-side validation that an end time is after its start time.
- Access restricted to accounts with the `BARBER` role and an active salon membership. A registered user or pending applicant cannot manage availability.

## API surface

- `GET /api/barber/availability/hours?weekStartDate=YYYY-MM-DD`
- `PUT /api/barber/availability/hours` with `weekStartDate`, `dayOfWeek`, `startTime`, and `endTime`
- `PUT /api/barber/availability/hours/bulk` with `weekStartDate`, `daysOfWeek`, `startTime`, and `endTime`
- `GET /api/barber/availability/breaks?weekStartDate=YYYY-MM-DD`
- `POST /api/barber/availability/breaks` with Monday `weekStartDate`, `dayOfWeek`, `startTime`, and `endTime`
- `DELETE /api/barber/availability/breaks/{id}`
- `GET /api/barber/availability/days-off`
- `POST /api/barber/availability/days-off` with a future or current `date`; omit `startTime` and `endTime` for a full-day closure, or provide both for custom hours
- `DELETE /api/barber/availability/days-off/{id}`

Working hours and special dates originate in Flyway migration `V7__barber_availability.sql`; V17 adds `barber_breaks`.

## UI verification

1. Register or log in as a barber account.
2. Apply to a salon and have that salon owner approve the application.
3. Log in again if needed. The account card should show `BARBER` and the **Your availability** section should be visible.
4. Choose the Monday date for the week, leave Monday through Saturday selected, enter 09:00–17:00, and click **Save weekly schedule**. All selected days should appear below the form.
5. Uncheck any saved day to close it for that week, then save. That weekday should disappear from **Weekly hours**. If that day has a future blocking appointment, the API should reject the change and keep the old week unchanged.
6. A custom-hours special date is accepted only when its weekday is working in that date's week. An unchecked Tuesday, for example, cannot receive custom hours.
7. Add a break inside one working day. It should appear under **Breaks**; an overlapping or outside-hours break should be rejected.
8. Add a future date as unavailable, or provide special start and end times for a working weekday. It should appear under **Special date schedules**.
9. Remove a break or special date and confirm it disappears.
10. Try an end time before the start time; the API should reject it and the UI should show an error.

Customers and salon owners do not see this section, and direct requests without an approved barber membership receive `403 Forbidden`.

See [weekly availability replacement](24-Weekly-Availability-Replacement-Fix.md) for the exact replacement semantics and rollback tests.

See [barber breaks](27-Barber-Breaks-Fix.md) for slot splitting, validation, and booking-race behavior.
