# Trim-Time: Service Catalogue Walkthrough

Status: Feature 04 implemented.

## What this feature does

Salon owners can create and maintain the services their salon offers. Each service has a name, description, price, estimated duration, and active status. Active services can be read for a salon; only the salon owner can create, update, or deactivate that salon's services.

## Owner workflow

1. Log in as a salon owner.
2. Open **Service catalogue** below the salon profile.
3. Enter a service name, description, price, and duration between 5 and 480 minutes.
4. Choose **Add service**.
5. Confirm the service appears in **Your services**.
6. Choose **Deactivate** to hide it from the active catalogue while preserving the record.

## API behavior

- `GET /api/salons/mine/services` lists the owner's services.
- `POST /api/salons/mine/services` creates a service.
- `PUT /api/salons/mine/services/{id}` updates an owned service.
- `DELETE /api/salons/mine/services/{id}` deactivates an owned service.
- `GET /api/salons/{salonId}/services` lists active services for customers and barbers.

Prices are stored with two decimal places and durations are validated on the server. Ownership and the `SALON_OWNER` role are required for management operations.

When a user selects a salon in the barber onboarding form, the UI loads that salon's active services and displays their price and duration. This lets a barber see the services offered by the selected salon before sending an application. Inactive services are excluded.
