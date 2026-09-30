# Existing-feature fix 6: Barber breaks

Approved barbers can now save and remove multiple breaks for each working weekday in a configured week. Breaks participate in both advisory slot search and final transactional booking validation.

## Rules and storage

- A break belongs to a barber, Monday week-start date, weekday, start time, and end time.
- It must have positive duration, remain inside that weekday's regular saved hours, and not overlap another break. Adjacent breaks are allowed.
- A weekly-hours edit cannot leave an existing break outside the new interval. Closing a weekday removes all its breaks in the same transaction.
- Flyway V17 creates `barber_breaks`, enforces valid weekdays/time order and exact-interval uniqueness, and indexes barber/week/day/start lookups.
- Custom special-date hours define the effective outer work interval. Breaks for that weekday are subtracted where they intersect it; full-day closures still remove the complete day.

## Slot and booking behavior

Slot search divides the effective working interval around ordered breaks. Candidate generation begins independently in each remaining interval, allowing the first fitting appointment to begin exactly when a break ends.

Booking rechecks the complete requested interval after acquiring the salon lock. Any positive overlap with a break makes that barber ineligible. Back-to-back boundaries remain valid: an appointment may end at break start or begin at break end.

Break creation uses the shared salon-first write lock. After saving, existing confirmed or in-progress appointments are checked against the updated schedule; a conflict returns HTTP 409 with booking references and rolls back the break. Booking and break edits therefore remain correct in either concurrent lock order.

## Verification

Real-MySQL tests cover slot splitting, direct booking rejection, starts at break end, outside-hours and overlapping validation, hours-edit validation, day-closure cleanup, rollback over an existing appointment, and both orders of the booking-versus-break race.

Verification on 23 September 2026: `mvn -B -Pintegration verify` passed 2 unit tests and 41 MySQL integration tests. Frontend tests passed 7 tests, including break creation through the availability UI; lint and production build passed.
