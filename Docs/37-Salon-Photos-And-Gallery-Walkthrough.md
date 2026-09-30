# Feature Walkthrough: Salon Photo Uploading, Storage & Gallery

## 1. Overview
Salon owners can now upload up to 10 photos showcasing their salon interior, barber stations, and storefront. Customers browsing salons or viewing available appointment slots can see the salon photo gallery directly before booking.

---

## 2. Architecture & Implementation Details

### Database Schema (`V20__salon_photos.sql`)
- Table `salon_photos`:
  - `id` BIGINT AUTO_INCREMENT PRIMARY KEY
  - `salon_id` BIGINT NOT NULL (FK to `salons(id)`)
  - `storage_path` VARCHAR(512) NOT NULL (relative storage path on disk)
  - `content_type` VARCHAR(100) NOT NULL (e.g. `image/jpeg`, `image/png`, `image/webp`)
  - `size_bytes` BIGINT NOT NULL
  - `display_order` INT NOT NULL DEFAULT 0
  - `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  - Index on `idx_salon_photos_salon (salon_id, display_order)`

### Security & Storage Protection
- **Magic Bytes Validation**: `PhotoStorageService.detectAndValidateFormat` inspects file binary header signatures:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - WebP: `RIFF....WEBP`
- **File Limits**: Hard cap of 5 MB per photo and max 10 photos per salon.
- **Path Traversal Protection**: Random UUID filenames within salon-scoped subdirectories (`salons/{salonId}/{uuid}.{ext}`). Normalization check ensures path remains strictly inside the photo storage root.
- **Transactional Consistency**: Owner lock (`PESSIMISTIC_WRITE`) guarantees concurrency safety during uploads and count checks. When a photo record is deleted, the physical file on disk is also removed.

### API Endpoints
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/salons/mine/photos` | `SALON_OWNER` | Upload a photo (multipart `file`) |
| `GET` | `/api/salons/mine/photos` | `SALON_OWNER` | List photos belonging to owner's salon |
| `DELETE` | `/api/salons/mine/photos/{photoId}` | `SALON_OWNER` | Delete a photo and its storage file |
| `GET` | `/api/salons/{salonId}/photos` | Public / Customer | List photo gallery for a given salon |
| `GET` | `/api/salons/{salonId}/photos/{photoId}` | Public / Customer | Stream photo image bytes with caching headers |

---

## 3. Automated Verification
- **Integration Tests**: [`SalonPhotoIT.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/test/java/com/trimtime/photo/SalonPhotoIT.java) (4/4 passed):
  - Valid JPEG/PNG upload and byte stream retrieval.
  - Rejection of invalid magic bytes / spoofed MIME types (HTTP 415).
  - Maximum photo limit enforcement (10 photos -> 11th rejected with HTTP 409).
  - Photo deletion by owner and rejection of unauthorized deletion by another owner (HTTP 404).
- **Frontend Tests**: [`App.test.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.test.tsx) (17/17 passed):
  - Owner photo upload form, file selection, preview rendering, and deletion.
- **Linter & Build**: 0 errors, 0 warnings across frontend and backend.
