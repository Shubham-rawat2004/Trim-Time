# Trim-Time: Salon Directory, Location and Selection Walkthrough

Status: Salon selection and radius-based discovery implemented.

## What this feature does

Authenticated users can load the active salon directory from `GET /api/salons`. Each result shows the salon name, address, contact, description, owner display name, and optional distance. A request such as `GET /api/salons?latitude=29.1492&longitude=75.7217&radiusKm=5` uses Haversine straight-line distance and returns only salons within five kilometres, sorted nearest first. The customer UI uses a fixed five-kilometre search radius. The full directory remains available internally for barber onboarding and appointment selection. A salon without saved coordinates is still visible in the full directory but cannot match a radius search.

Salon owners can save optional latitude and longitude while creating or editing their salon. Both coordinates must be supplied together for a location-enabled profile. Customers first use the browser's location permission; exact customer coordinates are sent only for that search and are not stored. If permission is denied or unavailable, the customer can expand the manual fallback and enter coordinates.

When a user chooses a salon and submits an application, the selected salon ID is sent to the backend. The application is stored against that salon and appears only in that salon owner's pending approval list. The owner identity shown in the directory is informational; authorization still comes from the server-side salon ownership relationship.

## Manual test

1. Log in at `http://localhost:8088` as a salon owner and create or edit a salon.
2. Enter a valid latitude and longitude, then save the profile.
3. Log in as a customer and open **Find nearby salons**.
4. Select **Use my location** and allow browser permission. Confirm matching salons within 5 km show their distance and nearer salons appear first.
5. Test with a location that has no salon within 5 km and confirm the UI shows that no nearby salons were found.
6. Deny location permission, expand **Enter location manually**, and confirm the fallback search still works within 5 km.
7. Select a salon in **Barber onboarding** and submit an application. Confirm the request still uses the complete salon directory and appears only in that salon owner's pending approval list.

The endpoint requires an authenticated session. Radius filtering is straight-line distance, not driving distance. Salon creation remains self-service under the approved MVP policy; a separate platform-admin verification flow is not part of the current scope.
