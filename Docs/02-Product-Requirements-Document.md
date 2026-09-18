# Trim-Time: Product Requirements

Status: proposed detailed requirements within the [agreed scope](01-MVP-Scope.md). Policies identified as open must be settled before their dependent implementation.

## Actors

- Customer: discovers salons and manages their own bookings.
- Barber: views assigned appointments and performs permitted status updates.
- Salon owner: manages their own salon, staff, services, schedules, and appointments.

Role membership alone never grants access to every record of that type.

## Finalized onboarding and relationships (18 September 2026)

1. A new user registers with CUSTOMER access; an existing user keeps the same account and credentials.
2. The user chooses to join as a barber, completes a barber profile, selects a registered salon, and submits a PENDING request.
3. The user can inspect or withdraw their own request. Only the selected salon's owner can approve or reject it.
4. Approval atomically activates membership and BARBER access. Rejection leaves customer access intact and grants no salon access.
5. The owner configures supported services and working hours. Approval alone does not make the barber bookable.

Request states: PENDING, APPROVED, REJECTED, WITHDRAWN. A user may have at most one pending request and one active barber membership. An existing membership must end before joining a different salon; future appointments must be explicitly resolved first.

Accounts support multiple roles. Creating one's salon grants SALON_OWNER through the salon-setup workflow; each owner can own at most one salon, each salon has one owner and many barbers. An owner can add themselves as a barber at their own salon without a join request, while preserving the single-active-membership limit.

Acceptance: pending applicants cannot read salon appointments; another owner cannot approve the request; repeated/concurrent approvals cannot create duplicate membership; concurrent salon creation cannot give an owner two salons; approved staff without eligible schedules/services are not offered for booking. All roles retain their own customer functionality.

This flow replaces the earlier owner-invitation proposal. No separate mobile app, KYC service, email invitation delivery, or platform-admin approval is included.

## Functional requirements and acceptance

| Feature | Expected behavior | Acceptance evidence |
| --- | --- | --- |
| F01 | Register, log in, log out; reject duplicate account identifiers and invalid credentials. | Logout invalidates the session; passwords are never returned. |
| F02 | Owners maintain salon details and valid images. | Another owner cannot edit the salon; invalid coordinates and files are rejected. |
| F03 | Search from permitted device coordinates or a manually selected point. | Permission denial does not block manual selection; radius filtering uses straight-line distance. |
| F04 | Owners maintain active services with positive duration and nonnegative price. | Customers see current offerings; deactivation does not change old bookings. |
| F05 | Select only compatible add-ons supported by the selected barber. | Server recomputes total price and duration; forged client totals have no effect. |
| F06 | Maintain eligible services, working intervals, breaks, and day-off exceptions. | Proposed schedule changes conflicting with future appointments are rejected. |
| F07 | Return future slots fitting salon hours, barber hours, breaks, and bookings. | A 45-minute appointment is not offered inside a 30-minute opening. |
| F08 | Confirm availability again when booking. | Two simultaneous overlapping requests for one barber yield at most one success. |
| F09 | Display an immutable booking reference and booked details. | Customer history includes only their records and preserves original prices. |
| F10 | Filter appointments by date and status, with pagination. | Owner sees only owned salons; barber sees only assigned bookings. |
| F11 | Evaluate cancellation on the server against a versioned policy. | Boundary times and repeated cancellation requests behave deterministically. |
| F12 | Enforce roles and object ownership on every protected operation. | Cross-customer, cross-barber, and cross-owner access tests fail safely. |

## Booking lifecycle

Proposed states: CONFIRMED, COMPLETED, CANCELLED, NO_SHOW.

- Successful creation enters CONFIRMED directly; there is no unpaid or payment-pending state.
- CONFIRMED may transition to a terminal state when actor permissions and time rules allow it.
- Terminal states cannot be reopened through normal MVP endpoints.
- Customers may cancel only their own eligible confirmed appointments.
- Owners may complete, cancel, or mark no-show for appointments at their salons.
- Proposed barber permission: complete or mark no-show for assigned appointments; cancellation remains with customers and owners.
- Completion is allowed only after the appointment start; the exact no-show grace period is open.
- No endpoint changes the appointment's time or assigned barber after creation.

Owner cancellation rules may differ from customer rules; the distinction must be explicit and recorded.

## Scheduling and money

- Use half-open intervals: an appointment ending at 10:30 does not overlap one starting at 10:30.
- An appointment must fit entirely inside eligible working intervals.
- The API accepts explicit timestamps with offsets and returns clear salon-local display information.
- Use UTC instants for stored appointments and an IANA time-zone identifier for each salon.
- Store currency amounts as decimal values; this is a displayed service total, not evidence of payment.
- Existing bookings preserve service name, price, duration, and policy version as recorded at confirmation.

## Experience requirements

- Show price, estimated duration, salon, barber, and time before confirmation.
- If a displayed slot becomes unavailable, retain selections and refresh availability.
- Show actionable loading, empty, validation, conflict, and permission states.
- Display cancellation eligibility and applicable policy before the action.
- Provide accessible form labels, keyboard navigation, and responsive layouts.

## Open decisions

| Decision | Needed before |
| --- | --- |
| Cancellation window, reference time, owner exceptions, and whether any penalty is merely informational | F11 implementation |
| Slot start interval, maximum advance booking, and minimum notice | Availability implementation |
| No-show grace period | Status-update implementation |
| Default currency, time zone, and photo size/count limits | Validation and UI completion |
| Manual location selection UX; map/geocoding provider if desired | Discovery UI |

The handwritten one-minute/five-minute cancellation proposal is not a finalized requirement. Do not silently adopt it or implement financial deductions.

Later discussion also proposed a one-hour cancellation cutoff, 30-day booking horizon, 30-minute notice, 15-minute slot increments/no-show grace, manual map selection, and INR/Asia-Kolkata defaults. These remain unapproved suggestions, not acceptance criteria. Exact barber status-update permissions also remain open.
