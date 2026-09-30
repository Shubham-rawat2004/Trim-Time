# Existing-feature fix 4: Salon-local slot time handling

Slot search and booking confirmation now use the salon timezone as the source of truth for “today” and “now”.

## What changed

- The application exposes an injectable UTC `Clock`, so production code and tests use the same time source.
- Slot search resolves the selected salon before validating the requested date, then compares the date with the salon-local date.
- Same-day slot search filters out candidate starts earlier than the salon-local current time.
- Appointment confirmation rejects past starts using the same salon-local clock used by slot search.
- Slot generation now builds candidate ranges with `LocalDateTime` instead of adding durations directly to `LocalTime`.
- Services and add-ons must fit inside the same dated working interval. Durations that would cross midnight or wrap around the clock are rejected as unavailable.
- Salon create/update validates that the supplied timezone is a real IANA timezone such as `Asia/Kolkata`.

## Why it matters

Previously, “past” checks depended on the server machine timezone. A salon could expose already-expired slots if the server and salon were in different timezones, and a direct booking request could use a different interpretation of “now” than the slot search. Long services near the end of a day also relied on `LocalTime` arithmetic, which can wrap past midnight.

The backend now treats the salon timezone as the booking boundary. Advisory slot search and final appointment confirmation use the same rule, and confirmation still rechecks availability under the salon booking lock.

## Verification

`mvn -Pintegration verify` now includes `SlotTimeHandlingIT`, which fixes the test clock at 22 September 2026 11:30 Asia/Kolkata and verifies:

- Same-day slots before salon-local “now” are hidden.
- Direct booking before salon-local “now” is rejected.
- Dates before the salon-local current date are rejected.
- A long valid service inside a shorter evening working window returns no slots and cannot wrap past midnight.

Verification on 23 September 2026: backend `mvn -Pintegration verify` passed 2 unit tests and 29 MySQL integration tests.

The follow-up [salon-time consistency fix](28-Salon-Time-Consistency-Fix.md) applies the same salon-local clock to availability defaults and appointment protection, persists explicit UTC instants, and rejects ambiguous or nonexistent daylight-saving local times.

## Remaining audit items

This fix does not change slot granularity. Current slot starts advance by the combined appointment duration. A separate slot-interval fix should decide whether the product needs 15-minute, 30-minute, or owner-configurable start intervals.
