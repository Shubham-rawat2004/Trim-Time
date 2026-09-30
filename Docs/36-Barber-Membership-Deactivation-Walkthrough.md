# Barber Membership Deactivation and Departure Walkthrough

## Summary
Implements lifecycle departure and deactivation for barber memberships in Trim-Time:
1. **Salon Owner-initiated deactivation**: A salon owner can remove/deactivate a barber from their salon via `DELETE /api/salons/mine/barbers/{barberId}`.
2. **Barber voluntary departure**: An active barber can voluntarily leave a salon via `DELETE /api/barber/membership` (or `POST /api/barber/membership/leave`).

Both departure flows enforce strict business integrity:
- **Appointment Protection**: If the departing/deactivated barber has unfinished upcoming appointments (`CONFIRMED` or `IN_PROGRESS`), deactivation is blocked with `AppointmentConflictException` (HTTP 409 Conflict) returning the list of conflicting booking references, preventing orphaned appointments.
- **Qualification Cleanup**: Associated barber service qualifications are deleted from `barber_services`.
- **Role Synchronization**: The `BARBER` role is cleanly revoked from the user account (`barber.removeRole(Role.BARBER)`), updating the authorization version and session context.
- **Re-application**: The user's `BarberMembership` record is deleted, allowing them to re-apply to another salon or rejoin in the future.

---

## Changes Implemented

### 1. Appointment Protection (`AppointmentProtection.java`)
- Added `membershipDeactivation(Long barberId)`:
  - Finds all unfinished appointments (`findUnfinished(barberId, salonTime.now(salon), BLOCKING)`).
  - Rejects if any non-empty list of conflicting appointments is found.

### 2. Backend Service (`BarberService.java`)
- Injected `BarberServiceQualificationRepository` and `AppointmentProtection`.
- Added `deactivateBarber(Long ownerId, Long barberId)`:
  - Locks salon and barber (`locks.owner(ownerId)` -> `users.lockId(barberId)`).
  - Checks membership belongs to caller's salon (`BarberMissingException` -> HTTP 404).
  - Enforces `protection.membershipDeactivation(barberId)`.
  - Deletes qualifications and membership.
  - Revokes `Role.BARBER` from the barber account and saves.
- Added `leaveSalon(Long barberId)`:
  - Verifies barber has an active membership (`MembershipMissingException` -> HTTP 404).
  - Locks salon and barber (`locks.salon(salonId)` -> `users.lockId(barberId)`).
  - Enforces `protection.membershipDeactivation(barberId)`.
  - Deletes qualifications and membership.
  - Revokes `Role.BARBER` from the account and saves.

### 3. Backend Controller & Exception Handler
- In [`BarberController.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/barber/BarberController.java):
  - `@PreAuthorize("hasRole('SALON_OWNER')") @DeleteMapping("/salons/mine/barbers/{barberId}")`
  - `@PreAuthorize("hasRole('BARBER')") @DeleteMapping("/barber/membership")`
  - `@PreAuthorize("hasRole('BARBER')") @PostMapping("/barber/membership/leave")`
- In [`ApiExceptionHandler.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/system/ApiExceptionHandler.java):
  - Mapped `BarberMissingException` (404) and `MembershipMissingException` (404).

### 4. Integration Tests (`BarberOnboardingIT.java`)
- `ownerCanDeactivateBarberWithoutUpcomingAppointments`: Tests that an owner can remove a barber, revoking membership and `Role.BARBER`, and allowing the barber to re-apply elsewhere.
- `barberCanLeaveSalonVoluntarily`: Tests that a barber can voluntarily depart, cleaning up membership and role.
- `cannotDeactivateBarberWithUnfinishedAppointments`: Verifies that upcoming confirmed appointments strictly block deactivation and departure with `AppointmentConflictException`, preserving membership and roles.

### 5. Frontend UI (`App.tsx` & `App.test.tsx`)
- In "BARBER QUALIFICATIONS", added **"Remove barber"** button for each barber.
- In "YOUR AVAILABILITY", added **"Leave salon"** card and button for active barbers.
- Added 2 unit tests in `App.test.tsx` verifying owner removal and voluntary barber departure.

---

## Verification
- `BarberOnboardingIT`: 15/15 integration tests passed.
- Frontend Vitest: 16/16 unit tests passed.
- Oxlint: 0 errors, 0 warnings.
- Production build: Succeeded cleanly.
