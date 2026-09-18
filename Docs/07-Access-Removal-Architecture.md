# Trim-Time: Role Access and Removal Architecture

The reference filename is retained. This document concerns application roles and salon/barber access, not repository collaborators or GitHub permissions.

Status: security design supporting F12. No platform-admin dashboard or general account-deletion workflow is added to scope.

## Permission matrix

| Action | Customer | Barber | Salon owner |
| --- | --- | --- | --- |
| Browse active salons/services | Yes | Yes | Yes |
| Create customer booking | With customer role | With customer role | With customer role |
| Read customer history | Own only | No blanket access | Owned salon appointments only |
| Read assigned appointments | No | Own assignment only | Owned salon only |
| Edit salon/services/schedules | No | No in initial scope | Owned salon only |
| Cancel | Own, policy eligible | Not proposed initially | Owned salon, owner rules |
| Complete / mark no-show | No | Assigned, time eligible | Owned salon, time eligible |
| Submit/withdraw barber join request | Own request | Only after ending existing membership for another salon | Same single-membership rule |
| Approve/reject barber join request | No | No | Own salon only |
| Remove barber membership | No | No | Own salon only, subject to appointment checks |

Barber status-update details still require final agreement. Onboarding is finalized: barber applies, salon owner approves. Never allow a customer to obtain privileged membership by sending an arbitrary role in a registration request.

## Finalized account and membership lifecycle

- Registration grants CUSTOMER. Users can combine CUSTOMER, BARBER, and SALON_OWNER in one account; switching dashboard views grants no new permission.
- A barber profile and PENDING/REJECTED/WITHDRAWN request grant no salon appointment access. Applicants can inspect their own request status.
- Only the selected salon's owner can approve/reject a PENDING request. Approval activates membership and BARBER access atomically.
- Supported services and working hours must be configured before an approved barber is bookable.
- One owner owns at most one salon; each salon has exactly one owner and may have many barbers.
- One barber has at most one active salon membership and one pending join request. An existing membership must end before joining another salon.
- Salon setup grants owner access through a controlled workflow. Owners may enroll themselves as barbers at their own salon without applying, subject to the same active-membership limit.
- Owner invitations, platform-admin verification, document checks, and email onboarding are not part of this flow.

Permissions are additive: owners and barbers retain access to their own customer bookings through CUSTOMER. The matrix describes each role's permissions independently.

## Checks on protected operations

1. Resolve the authenticated account from the session.
2. Verify current active status and current authorization version/membership.
3. Check the required role.
4. Check ownership or barber assignment against database data.
5. Check business state and timing before mutation.

Frontend route guards are presentation only. Query filtering and service-layer authorization must independently enforce record boundaries.

## Staff deactivation proposal

An owner may deactivate only a barber at their own salon. Use the booking consistency lock order. If future confirmed appointments exist, reject deactivation and list authorized conflict references. The owner must explicitly resolve them through permitted cancellation first; automatic reassignment and rescheduling are excluded.

After deactivation, block new assignments and barber-specific access for that membership. Remove BARBER access when no active membership remains and increment authorization_version in the same transaction. Preserve appointment history and the account's CUSTOMER and any independent SALON_OWNER role.

## Existing sessions after permission changes

Do not rely only on roles copied into a session at login. Proposed mechanism: store an authorization version with the session, compare it against current account state on protected requests, and reject or refresh stale authorities after a role change. Also read current barber membership and salon ownership for object-specific access.

Sensitive mutations revalidate membership inside their transaction. Requests already completed before revocation remain completed; the system does not undo them.

In-memory sessions are acceptable for one backend instance. Persistent or distributed sessions are outside the initial architecture.

## Boundaries and unresolved workflows

- Owner-to-owner salon transfer is not included.
- Global role administration is not a new user-facing feature.
- Account deletion, retention, and legal erasure policy require a separate decision.
- Deactivation must not cascade-delete bookings or change original actor attribution.

## Verification

Test cross-owner profile edits, cross-barber booking access, customer access to another customer's booking, stale-session access after membership removal, role tampering during registration, and staff deactivation racing with a new booking.

Also test pending-applicant access denial, wrong-owner approval, withdrawal versus approval, repeated approval, concurrent applications to different salons, owner self-enrollment, and concurrent attempts to create two salons for one owner.
