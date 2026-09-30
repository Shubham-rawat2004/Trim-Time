# Existing-feature fix 1: Booking and availability consistency

Booking and availability-affecting edits now acquire the same salon-row lock before reading booking inputs. These write transactions explicitly use READ COMMITTED. Booking then acquires eligible membership locks in ascending ID order and keeps automatic assignment ordered by barber display name, with membership ID as a tie-breaker.

## Participating operations

- Appointment confirmation.
- Weekly hours, bulk weekly hours, special-date creation, and special-date removal.
- Break creation and removal.
- Owner updates to barber service qualifications.
- Catalogue creation, updates, and deactivation, including add-ons.
- Salon profile updates and owner application decisions that can create membership.

Only scalar routing IDs may be read before the salon lock. Barber membership is checked again after acquiring the lock. Candidate slot reads remain advisory; booking validates committed inputs under the lock.

## Protecting appointments

Schedule edits are flushed inside the transaction, then checked against non-ended CONFIRMED and IN_PROGRESS appointments on affected dates. Validation uses the effective schedule, including special-date overrides. A conflict rolls back the whole request, including previously updated days in a bulk edit. Removing extended special hours is checked too.

Qualification changes must preserve every primary service required by those appointments. Migration V14 adds `appointment_required_services`; new appointments record immutable service IDs alongside the existing name/price/duration summaries. Catalogue price, duration, and name changes still apply only to new bookings.

Older appointments contain only mutable name summaries. V14 deliberately does not guess service IDs. While such an appointment remains non-ended and blocking, qualification removal is rejected conservatively; retaining or adding qualifications remains possible. This limitation is necessary until old appointments have ended or their service requirements are explicitly reconciled.

Conflicts return HTTP 409 with a safe explanation and `bookingReferences`. Checks run after salon ownership or barber membership validation. The React forms display the explanation/references and retain saved state when an edit fails.

## Verification

`mvn -Pintegration verify` runs real MySQL tests covering overlapping and adjacent bookings; both orders of booking versus hours and qualifications; booking after catalogue edits; special-date creation/removal; bulk rollback; multi-service requirements; legacy appointments; and wrong-owner access.

`npm test`, `npm run lint`, and `npm run build` cover frontend regression checks. A new interaction test verifies that a conflicting weekly-hours edit displays its references and preserves the saved hours.

## Remaining audit items

This fix did not originally complete structured item snapshots or authentication lifecycle work. Those are now covered by fixes 8 and 9. Cancellation and staff removal do not yet exist and must join this lock protocol when implemented.

Verification on 22 September 2026 with fixes 1, 2, and 3 together: `mvn -Pintegration verify` passed 2 unit tests and 27 MySQL integration tests (18 booking consistency, 8 onboarding consistency, 1 foundation). Frontend: 6 tests, lint, and production build passed.

The unchecked-working-day gap is now covered by [weekly availability replacement](24-Weekly-Availability-Replacement-Fix.md).

The server-local timing and `LocalTime` wrap gap is now covered by [slot time handling](25-Slot-Time-Handling-Fix.md).

The lost-response duplicate-booking gap is now covered by [booking retry safety](26-Booking-Retry-Safety-Fix.md).

The missing-break gap is now covered by [barber breaks](27-Barber-Breaks-Fix.md).

The remaining server-clock and daylight-saving ambiguity gaps are covered by [salon-time consistency](28-Salon-Time-Consistency-Fix.md).

Structured immutable booking line items are covered by [appointment item snapshots](29-Appointment-Item-Snapshots-Fix.md). Status-transition history remains a later feature.

Session rotation, authorization-version refresh, and inactive-account revocation are covered by [session lifecycle](30-Session-Lifecycle-Fix.md).
