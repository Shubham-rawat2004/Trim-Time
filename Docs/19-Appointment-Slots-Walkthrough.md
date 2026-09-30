# Feature 07: Appointment slot generation

Trim-Time now calculates customer-facing appointment slots from the selected salon, one or more services, add-ons, date, and approved barber availability.

## What is included

- Active service validation for every selected service in the selected salon.
- Compatible active add-on validation.
- Total duration equal to all selected service durations plus all selected add-on durations.
- Total price equal to all selected service prices plus all selected add-on prices.
- Week-specific barber hours and special-date hours.
- Week-specific breaks split the effective work interval. Candidate generation restarts at each break end, and no returned appointment crosses a break.
- Full-day special closures remove a barber's slots for that date.
- Slots are generated inside the salon's timezone. Past dates and same-day starts earlier than the salon-local current time are hidden.
- Every returned slot includes UTC start/end instants and the salon timezone alongside its local date and times.
- Local times in a daylight-saving gap or overlap are omitted because they do not identify exactly one instant.
- Candidate starts currently advance by the complete combined appointment duration. A finer start interval is a remaining product decision.
- Services and add-ons must fit inside one dated working interval; durations cannot wrap past midnight.
- Each result includes the date, start/end time, total combined duration, and total price. Barber identity is assigned internally and shown after confirmation.

Slot calculation is followed by Feature 08 booking confirmation, which assigns one barber and rechecks availability transactionally.

## API

`GET /api/slots?salonId={id}&serviceIds={id}&serviceIds={id}&addonIds={id}&date=YYYY-MM-DD`

Repeat `addonIds` for multiple add-ons. The endpoint requires an authenticated session and returns an empty list when no eligible barber has hours for the date.

## UI verification

1. Log in as any authenticated customer.
2. In **Find an appointment slot**, choose a salon and select one or more active services.
3. Select any compatible add-ons and a future date.
4. Click **Find available slots**.
5. Confirm each slot shows the combined start/end time, salon timezone, duration, and complete price. The barber is selected internally and is shown only after booking.
6. Change the add-ons and search again. Duration and price should change by the selected add-ons.
7. Choose a date where the barber has no weekly hours or has a full-day closure. No slots should be returned.
8. Choose a date with a custom-hours exception. Results should stay inside the special interval.
9. Add a break and confirm no result overlaps it; if enough time remains, the first result after it begins at the break end.
10. Search for the salon-local current date. Earlier times should not be returned.

Select **Book this time** on a result to continue into booking confirmation. The customer sees the assigned barber only after confirmation.

See [slot time handling fix](25-Slot-Time-Handling-Fix.md) for the salon-local date/time rules and midnight-wrap protection.

See [barber breaks](27-Barber-Breaks-Fix.md) for interval subtraction and transactional booking checks.

See [salon-time consistency](28-Salon-Time-Consistency-Fix.md) for UTC instant output, salon-local availability boundaries, and daylight-saving handling.
