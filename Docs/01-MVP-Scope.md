# Trim-Time: MVP Scope

Status: planning baseline; no application implementation exists yet.

## Purpose

Build a salon appointment application for a resume and technical interviews. Customers discover nearby salons and book a barber's available time. Salon owners maintain services and schedules, and barbers view and manage their assigned appointments within permitted boundaries.

The intended benefit is reduced waiting and clearer appointment information. Appointment times are estimates; the application cannot guarantee that a real salon always runs on time.

## Agreed features

| ID | Feature | Scope |
| --- | --- | --- |
| F01 | Registration and login | One account with secure login/logout; barber self-registration and salon-owner approval. |
| F02 | Salon profiles | Address, coordinates, contact details, opening hours, photos, and description. |
| F03 | Nearby discovery | Search within a radius such as 5 km using a selected location; straight-line distance. |
| F04 | Service catalogue | Service name, description, price, and estimated duration. |
| F05 | Add-on selection | Compatible extras contribute to both total price and sequential duration. |
| F06 | Barber availability | Supported services, working hours, breaks, and days off. |
| F07 | Appointment slots | Slots derived from selected services and eligible barber availability. |
| F08 | Conflict-safe booking | Server-side confirmation with MySQL transaction and locking protection. |
| F09 | Confirmation and history | Reference, salon, barber, service snapshots, time, price, and status. |
| F10 | Appointment dashboard | Owners view salon appointments; controlled completion, cancellation, and no-show updates. |
| F11 | Cancellation policy | Server-time eligibility rules; exact windows and penalty rules are unresolved. |
| F12 | Role-based access | CUSTOMER, BARBER, SALON_OWNER permissions plus record ownership checks. |

F01 covers identity and login. F12 defines authorization; these are complementary requirements.

## Explicit exclusions

- Slot swapping and appointment rescheduling.
- Payment collection, deposits, refunds, commission payouts, and payment-provider integration.
- Reviews, loyalty rewards, notifications, analytics, and platform-administrator dashboards.
- Home appointments, AI hairstyle suggestions, and hair-care referrals.
- GitHub API integration. Git and GitHub may still be used for source control.

## Agreed stack

- Frontend: React, Vite, TypeScript, React Router, CSS Modules, Fetch API.
- Backend: Java, Spring Boot, Spring Web, Spring Security, session authentication, Spring Data JPA/Hibernate, Jakarta Bean Validation, Maven.
- Data: MySQL/InnoDB, Connector/J, Flyway, persistent photo storage.
- Containers: Docker, Docker Compose, Nginx, persistent Docker volumes.
- Verification: JUnit, Spring Boot Test, Spring Security Test, Testcontainers with MySQL, Vitest, React Testing Library, Postman.
- Supporting tools: Git/GitHub, Node.js/npm, browser geolocation, Haversine calculation, Java date/time APIs.

Exact compatible dependency versions will be pinned during setup. No deployment provider has been selected.

## Finalized identity and salon decisions (18 September 2026)

- Barbers register or reuse an account, complete a profile, select a registered salon, and submit a join request. Only that salon's owner approves or rejects it.
- Approval grants barber access and activates salon membership. Pending/rejected applications grant no salon appointment access. Supported services and working hours must be configured before booking eligibility.
- A user may have one pending join request and one active barber salon membership at a time. Owner invitations are not the MVP onboarding flow.
- One account can hold CUSTOMER, BARBER, and SALON_OWNER together. Normal registration grants CUSTOMER; additional roles come from controlled onboarding.
- An owner may add themselves as a barber at their own salon without a join request, subject to the same single-active-membership rule.
- An owner account owns at most one salon. Each salon has exactly one owner and can have many barbers.
- This is salon membership approval, not independent professional-qualification verification. No email or document-verification service is required.

## Proposed MVP simplifications

These are implementation recommendations, not additional user-approved business rules:

- A barber serves one customer at a time.
- One appointment has one barber; that barber must support all selected services.
- Durations add sequentially; no shared equipment or parallel treatment scheduling.
- Start with one configured currency and no tax calculation engine.
- No overnight opening intervals initially; support them only after an explicit design revision.

## Completion criteria

A customer can discover a salon, select services, see availability, create a booking, view it, and cancel when eligible. An owner can maintain salon data and availability; a barber can access only their assignments. Concurrent overlapping bookings cannot both succeed. The application runs through Docker Compose and preserves data across container replacement.

## Document map

- [Product requirements](02-Product-Requirements-Document.md)
- [System architecture](03-System-Architecture.md)
- [Database design](04-Database-Design.md)
- [Booking consistency / sync design](06-Sync-Engine-Design.md)
- [Role-access removal](07-Access-Removal-Architecture.md)
- [Audit and security](08-Audit-Security-Specification.md)
- [Roadmap and phase gates](09-Roadmap-And-Phase-Gates.md)

Number 05 is intentionally absent: GitHub API Integration is excluded. Filenames follow the reference screenshot; documents 06 and 07 are adapted to this project's domain.
