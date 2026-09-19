# Trim-Time: Salon Directory and Selection Walkthrough

Status: Salon selection flow implemented.

## What this feature does

Authenticated users can load the active salon directory from `GET /api/salons`. Each result shows the salon name, address, contact, description, and owner display name. The barber onboarding form now uses this directory instead of asking the user to type an unexplained salon ID.

When a user chooses a salon and submits an application, the selected salon ID is sent to the backend. The application is stored against that salon and appears only in that salon owner's pending approval list. The owner identity shown in the directory is informational; authorization still comes from the server-side salon ownership relationship.

## Manual test

1. Log in at `http://localhost:8088`.
2. Scroll to **Barber onboarding**.
3. Open **Choose a salon** and confirm that each option includes a salon name, address, and owner.
4. Select a salon and submit an application.
5. Log in as that salon's owner.
6. Confirm the application appears in **Pending owner approvals** for that owner only.

The endpoint requires an authenticated session. Salon creation remains self-service under the approved MVP policy; a separate platform-admin verification flow is not part of the current scope.
