# Salon Owner Self-Enrollment Walkthrough

## Summary
Implements direct self-enrollment for salon owners to become active barbers in their own salons without submitting an artificial join request or requiring separate self-approval.

Previously, `BarberService.apply(...)` prohibited a salon owner from submitting a join request to their own salon (`"A salon owner cannot request to join their own salon"`), leaving salon owners who cut hair without a supported way to establish barber membership. Now, salon owners can directly enroll themselves via `POST /api/salons/mine/barbers/enroll-self`.

---

## Changes Implemented

### 1. Data Transfer Objects (`BarberDtos.java`)
- Added `SelfEnrollRequest(@Size(max=1000) String bio, @Min(0) @Max(80) Integer experienceYears)`.

### 2. Backend Service (`BarberService.java`)
- Added `enrollOwner(Long ownerId, BarberDtos.SelfEnrollRequest input)`:
  - Locks salon and owner record in consistent lock hierarchy (`locks.owner(ownerId)` -> `users.lockId(ownerId)`).
  - Validates that the owner does not already belong to a salon (`AlreadyMemberException` -> HTTP 409).
  - Automatically withdraws any lingering pending join requests by this user to keep `uq_join_requests_pending_barber` clean.
  - Inserts/updates `barber_profiles` with provided or default bio and experience years.
  - Grants `Role.BARBER` to the owner account, updating authorization version.
  - Saves a `BarberMembership` mapping the owner to their salon with approver set to the owner.

### 3. Backend Controller (`BarberController.java`)
- Added endpoint:
  ```java
  @PreAuthorize("hasRole('SALON_OWNER')")
  @PostMapping("/salons/mine/barbers/enroll-self")
  public ResponseEntity<BarberDtos.MembershipResponse> enrollSelf(
          @Valid @RequestBody(required = false) BarberDtos.SelfEnrollRequest input)
  ```
  Returns `201 CREATED` with the new membership details.

### 4. Integration Tests (`BarberOnboardingIT.java`)
- `ownerCanSelfEnrollAsBarberWithoutJoinRequest`: Tests that an owner can self-enroll, receives `Role.BARBER`, has an active `BarberMembership`, and cannot duplicate the enrollment.
- `concurrentSelfEnrollmentCreatesOneMembership`: Concurrency race test verifying mutual exclusion and clean `AlreadyMemberException` for competing requests.

### 5. Frontend UI (`App.tsx` & `App.test.tsx`)
- In the "BARBER QUALIFICATIONS" section, if the salon owner has not yet enrolled as a barber (`!account.roles.includes('BARBER')`), an "Owner self-enrollment" action card is rendered with an **"Enroll myself as barber"** button.
- Clicking the button calls `POST /api/salons/mine/barbers/enroll-self`, refreshes the session user (`/api/auth/me`), and updates the barbers list (`/api/salons/mine/barbers`), instantly unlocking availability schedules and qualification assignment for the owner.
- Added unit test in `App.test.tsx` verifying the complete UI workflow.

---

## Verification
- `BarberOnboardingIT`: 12/12 integration tests passed.
- Frontend Vitest: 14/14 unit tests passed.
- Oxlint: 0 errors, 0 warnings.
- Production build: Succeeded cleanly.
