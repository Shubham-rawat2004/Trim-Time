# Existing-feature fix 8: Structured appointment item snapshots

New appointments now store every selected service and add-on as an ordered immutable line item instead of relying only on comma-separated display summaries.

## What changed

- Migration V19 adds `appointment_items` with an appointment foreign key, item type, original catalogue ID, name snapshot, price snapshot, duration snapshot, and display order.
- Booking creates all item rows in the same transaction as the appointment, request key, required service IDs, totals, and time snapshots.
- Service items retain the customer's selection order; add-ons follow in their selection order.
- Appointment API responses expose an `items` array while retaining the aggregate `serviceName` and `addonSummary` fields for backward compatibility.
- Customer history displays the item-level duration and price breakdown.
- Catalogue renames, price/duration changes, and deactivation do not alter historical line items.

## Legacy policy

V19 does not split existing `service_name` or `addon_summary` strings. Names may contain commas and catalogue entries may have changed since booking, so parsing them would invent unreliable historical data. Legacy appointments return an empty `items` array and continue to display their preserved aggregate summaries.

The `catalogue_item_id` is an immutable source identifier paired with `item_kind`; it is deliberately not a foreign key to a live catalogue table. Historical appointment data therefore remains independent of catalogue lifecycle changes.

## Verification

The MySQL integration suite verifies that a multi-service booking with an add-on stores correctly ordered item types, names, prices, and durations, and that those snapshots remain unchanged after a service edit and add-on deactivation. It also verifies that a simulated legacy appointment with no item rows remains readable through its aggregate summary.

The frontend interaction suite verifies that the customer appointment card renders the structured item breakdown.

Verification on 23 September 2026: backend unit tests passed, and `mvn -Pintegration verify` passed 46 MySQL integration tests. Frontend passed 7 tests, lint, and production build.

## Remaining related work

Appointment status-history events are still absent. They should be introduced with controlled cancellation, completion, and no-show transitions so each event records an actual state change and actor.
