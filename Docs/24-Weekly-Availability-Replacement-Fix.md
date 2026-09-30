# Existing-feature fix 3: Weekly availability replacement

Saving weekly availability now treats the submitted checked weekdays as the complete schedule for that week.

## Behavior

- Checked days are created or updated with the submitted start and end time.
- Previously saved days that are now unchecked are deleted.
- Special-date overrides on deleted weekdays are deleted too, because that weekday is already closed.
- Submitting no checked days closes the whole week.
- If any deleted or changed day has a blocking appointment, the whole request rolls back.

This keeps the UI and backend aligned: unchecked now means closed, not "leave the old saved hours untouched."

## Verification

`BookingConsistencyIT` covers removing a previously saved day, closing an entire week, deleting a special-date override when its weekday is closed, and rolling back the whole request when closing a booked day would invalidate an appointment.

The React availability form now renders checkboxes from the saved week rather than hard-coded Monday-Saturday defaults, and a frontend regression test verifies that unchecking Tuesday submits only Monday and removes Tuesday from the displayed weekly hours.

Verification on 22 September 2026: `mvn -Pintegration verify` passed 2 unit tests and 27 MySQL integration tests. Frontend: 6 tests, lint, and production build passed.
