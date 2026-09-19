# Trim-Time: Salon Profile Editing Walkthrough

Status: Salon profile editing slice implemented.

Owners can edit the salon they own from the **Edit salon** action. The update uses `PUT /api/salons/mine`, keeps ownership server-side, validates the same fields as creation, and returns the saved profile. Non-owners cannot update another salon because the endpoint resolves the salon from the authenticated owner session.

## Manual test

1. Open `http://localhost:8088` and log in as the salon owner.
2. Find the salon card under Feature 02.
3. Select **Edit salon**.
4. Change the name or description and choose **Save changes**.
5. Confirm the updated values appear in the salon card.
6. Refresh the browser and confirm the values remain saved.

The service catalogue and add-ons are the next catalogue slices and will use this salon ownership boundary.
