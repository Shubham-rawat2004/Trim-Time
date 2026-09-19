# Trim-Time: Roadmap and Phase Gates

Status: implementation started. Phase 1 foundation, F01 identity/session access, the first F02 salon ownership slice, and F03 barber onboarding are implemented and verified in the local Docker stack. See the [foundation walkthrough](10-Foundation-Walkthrough.md), [identity walkthrough](11-Identity-Walkthrough.md), [salon ownership walkthrough](12-Salon-Ownership-Walkthrough.md), and [barber onboarding walkthrough](13-Barber-Onboarding-Walkthrough.md). This is an implementation sequence, not a time estimate.

## Phase 0: Resolve policies and prepare design

Finalized on 18 September 2026: barber self-registration with salon-owner approval, multiple roles per account, one salon per owner, one active salon membership per barber, and one pending join request at a time. Owners may self-enroll as barbers in their own salon.

Still confirm slot increment, booking horizon, cancellation policy, no-show grace period, exact barber status permissions, currency/time zone defaults, and location-selection UX. The suggested numerical defaults have not been approved. Pin compatible Java/Spring/MySQL/frontend/tool versions during setup.

Gate: unresolved rules are either decided or clearly isolated from work that can proceed independently. Do not invent cancellation penalties or expand scope.

## Phase 1: Application and container foundation

Create Spring Boot and React/Vite/TypeScript projects, Maven/npm builds, MySQL Compose service, Flyway baseline, Nginx routing, environment examples without secrets, and persistent volumes.

Gate: documented local commands start the stack, frontend reaches backend, backend reaches MySQL, migrations run reproducibly, and container replacement preserves a sample database record.

## Phase 2: Identity and permissions (F01, F12)

Implement registration/login/logout, session security, current-user endpoint, multiple roles, and identity/membership schema. The first salon setup slice and barber self-service application, owner approval/rejection, profile capture, and membership creation are complete. Phase 3 completes the rest of salon management. Applicant withdrawal and owner self-enrollment remain follow-up work within this phase.

Gate: role and ownership tests pass, arbitrary role escalation is rejected, logout invalidates the session, and stale membership cannot continue accessing protected data. Pending applicants have no salon access. Repeated/concurrent approval creates at most one active membership; one-pending-request and one-salon-per-owner limits survive concurrent requests.

## Phase 3: Salon, catalogue, discovery (F02-F05)

Build owner salon editing, validated photos, service/add-on catalogue, coordinates, radius discovery, and customer detail screens.

Gate: only owners edit their salons; discovery works without device permission through manual selection; server totals account for compatible add-ons; photos persist across container replacement.

## Phase 4: Availability and booking (F06-F08)

Implement schedules, breaks, days off, qualifications, slot calculation, booking snapshots, MySQL locking, and request-key retry handling.

Gate: real-MySQL tests cover overlap races, adjacent appointments, duration boundaries, different barbers, invalid qualifications, repeated requests, and concurrent schedule changes. A conflicting booking fails without partial records.

## Phase 5: History, dashboard, cancellation (F09-F11)

Build paginated customer history, owner/barber views, allowed terminal transitions, policy-controlled cancellation, and booking history events.

Gate: exact cancellation/no-show boundaries are tested; cross-record access is denied; terminal transitions cannot be repeated incompatibly; no payment or rescheduling behavior is introduced.

## Phase 6: End-to-end verification and presentation

Complete responsive and accessible UI states, frontend interaction tests, Docker images and Compose startup, operational configuration, and project README/demo instructions.

Gate: demonstrate customer booking and cancellation, owner maintenance, barber access, simultaneous booking conflict handling, and persistent data. Verify fresh setup from the documentation and record actual test results.

## Interview demonstration

- Explain why locking an existing parent record protects an otherwise empty booking interval.
- Show how service duration and breaks shape availability.
- Explain role checks versus record ownership and stale-session handling.
- Demonstrate price/duration snapshots after catalogue changes.
- Explain UTC instants versus salon-local schedules.
- Show reproducible Docker setup and integration tests against MySQL.

Resume claims must describe implemented and verified behavior, with measured figures only when measurements exist.

## Change control

The approved baseline is [features F01-F12](01-MVP-Scope.md). Any change to scope or business rules should update the relevant requirements, schema/architecture documents, and acceptance criteria together. Reviews, payments, loyalty, notifications, home service, AI, slot swapping, rescheduling, and GitHub API integration remain excluded unless explicitly requested later.
