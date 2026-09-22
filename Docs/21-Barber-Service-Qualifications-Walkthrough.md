# Feature 08: Barber service qualifications

Trim-Time now lets a salon owner decide which active salon services each approved barber can perform. Customers choose the salon, one or more primary services, add-ons, date, and time; they never choose a barber.

## What the feature does

- Each approved barber has a qualification list stored in `barber_services`.
- The owner can view approved barbers and save their active service assignments from the **Assign services to your barbers** section.
- A barber with no qualification for any selected primary service is excluded from slot generation and booking.
- Add-ons inherit the qualification of their compatible selected primary service.
- Booking repeats the qualification check inside the transaction before assigning a barber, so a stale screen cannot bypass the rule.
- Existing approved barbers were seeded with the salon's active services by Flyway migration V12 to preserve existing behavior. New approved barbers start with no assignments and must be configured by the owner.

## Owner test

1. Log in as the salon owner.
2. Approve a barber application, or use an already approved barber.
3. Create at least two active services in **Service catalogue**.
4. In **Assign services to your barbers**, select one service for the barber and click **Save qualifications**.
5. Confirm the selected service remains checked after refreshing the page.
6. Leave the second service unchecked.

## Customer test

1. Log in as a customer and choose the salon and date on which the barber has working hours.
2. Search for the qualified service. Candidate slots should be returned.
3. Search for the unassigned service. No slots should be returned while no other qualified barber is available.
4. Assign the second service to the barber and search again. Slots should now appear.
5. Confirm a slot. The booking response and **Your appointments** list show the automatically assigned barber name.

The owner endpoints are `GET /api/salons/mine/barbers` and `PUT /api/salons/mine/barbers/{barberId}/services`. The update body contains the selected `serviceIds`; an empty list intentionally removes all qualifications.
