# Trim-Time: Add-On Selection Walkthrough

Status: Feature 05 implemented.

## What this feature does

Salon owners can create add-ons such as beard trims or hair washes and connect each add-on to a compatible service. Add-ons have their own price and extra duration. Owners can deactivate add-ons without deleting their history.

The active add-ons for selected services are available through `GET /api/salons/{salonId}/services/{serviceId}/addons`. The customer can select multiple compatible add-ons; an add-on is accepted when it is compatible with at least one selected primary service.

## Owner workflow

1. Log in as a salon owner.
2. Create at least one active service under **Service catalogue**.
3. Open **Add-on selection**.
4. Enter an add-on name, choose its compatible service, and set its extra price and duration.
5. Choose **Add add-on** and confirm it appears under **Your add-ons**.
6. Deactivate it when it should no longer be offered.

The add-on price and duration are kept separate from the base service so later booking logic can calculate a combined total and sequential duration.
