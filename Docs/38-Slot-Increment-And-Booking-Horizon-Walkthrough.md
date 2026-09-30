# Feature Walkthrough: Configurable Slot Start Increment & Advance Booking Horizon

## 1. Overview
Salons can now configure how frequently customer appointment slots start (e.g. 15-minute grid, 30-minute grid, or exact service duration) as well as the advance booking horizon (in days, e.g. 7, 14, 30, 60 days). Both features are enforced on the backend during slot candidate calculation and booking creation, with client-side date boundary feedback and salon profile management on the frontend.

---

## 2. Architecture & Implementation Details

### Database Schema (`V21__salon_booking_settings.sql`)
- Table `salons`:
  - `slot_increment_minutes` INT NULL (e.g. `15`, `30`, or `NULL` representing stepping by service duration)
  - `booking_horizon_days` INT NOT NULL DEFAULT 30 (enforces maximum allowed days ahead for appointment booking, 1–365 days)

### Backend Rules & Calculations
- **Candidate Slot Calculation** (`SlotService.find`):
  - When `slot_increment_minutes` is configured (e.g. 15 or 30), the slot generator advances `cursor = cursor.plusMinutes(increment)`.
  - When `slot_increment_minutes` is null, `cursor` advances by the combined service duration (`selection.duration`).
  - Candidate slots start at `cursor` and end at `cursor.plusMinutes(selection.duration)`.
  - Overlap check with existing bookings (`appointments.findOverlapping`) and barber breaks ensures no overlapping appointments are generated.
- **Advance Booking Horizon Enforcement** (`SlotService.find` & `AppointmentService.book`):
  - Checks if `date.isAfter(now.toLocalDate().plusDays(salon.getBookingHorizonDays()))`.
  - Throws `SlotService.BookingHorizonExceededException` (mapped to HTTP 400 Bad Request).
- **Slot Increment Alignment Defense** (`AppointmentService.book`):
  - Protects against forged API calls attempting to book slots at off-grid minutes (e.g. `09:10` when a 15-minute grid is configured).
  - Validates `startTime.getMinute() % slotIncrementMinutes == 0`.
- **Salon Settings Validation** (`SalonService`):
  - `slot_increment_minutes`: must be 15, 30, or null.
  - `booking_horizon_days`: must be between 1 and 365 days.

### API Changes
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/salons` | Accepts optional `slotIncrementMinutes` and `bookingHorizonDays` |
| `PUT` | `/api/salons/mine` | Updates salon settings including `slotIncrementMinutes` and `bookingHorizonDays` |
| `GET` | `/api/salons/mine` | Returns `slotIncrementMinutes` and `bookingHorizonDays` in `SalonResponse` |
| `GET` | `/api/salons` | Returns `slotIncrementMinutes` and `bookingHorizonDays` in `DirectoryResponse` |

---

## 3. Automated Verification
- **Integration Tests**: [`SalonBookingSettingsIT.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/test/java/com/trimtime/salon/SalonBookingSettingsIT.java) (7/7 passed):
  - 15-minute grid generation (e.g., 09:00, 09:15, 09:30, 09:45, 10:00, 10:15...).
  - 30-minute grid generation (e.g., 09:00, 09:30, 10:00, 10:30, 11:00).
  - Fallback to exact service duration when `slotIncrementMinutes` is null.
  - Rejection of slot search beyond configured advance booking horizon.
  - Rejection of direct booking beyond advance booking horizon.
  - Rejection of unaligned booking start times (e.g., 09:10 on a 15-minute grid).
  - Validation of allowed values (15 or 30 min, 1–365 days).
- **Regression Suite**: All 82 backend integration tests passed.
- **Frontend Tests**: [`App.test.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.test.tsx) (18/18 passed):
  - Owner salon editing with slot grid selector and booking horizon input.
  - Date input calendar with `max` date set to `today + bookingHorizonDays`.
- **Linter & Build**: 0 errors, 0 warnings across frontend and backend.
