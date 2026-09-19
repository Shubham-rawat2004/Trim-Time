# Trim-Time: Barber Onboarding Walkthrough

Status: Feature 03 implemented.

## What this feature does

A signed-in user can apply to join a salon by salon ID. The application stores a barber profile, optional experience details, and a message. It starts as `PENDING`.

The salon owner can view pending applications for the owner's salon and approve or reject them. Approval creates one barber membership and adds the `BARBER` role while preserving existing roles such as `CUSTOMER`. The service prevents duplicate pending applications and prevents a barber from belonging to more than one salon.

## Endpoints

- `POST /api/barber/applications/{salonId}` creates an application.
- `GET /api/barber/applications/mine` lists the signed-in user's applications.
- `GET /api/salons/mine/barber-applications` lists pending requests for the owner's salon.
- `POST /api/salons/mine/barber-applications/{requestId}/approve` approves and creates membership.
- `POST /api/salons/mine/barber-applications/{requestId}/reject` rejects an application.

All state-changing requests require the session CSRF token returned by `GET /api/auth/csrf`.

## Manual UI test

1. Start the stack and open `http://localhost:8088`.
2. Create or log in as a customer account.
3. Choose a salon from the directory in the **Barber onboarding** form and submit an application. The option shows the salon name, address, and owner.
4. Log out or use another browser session and log in as the salon owner.
5. Review **Pending owner approvals** and approve the application.
6. Log back in as the barber and confirm the application is `APPROVED` and the account roles include `BARBER`.
7. Submit the same application again or apply after approval and confirm the conflict response explains the membership rule.

The current directory is a selection prerequisite. Radius-based nearby discovery remains a later feature.
