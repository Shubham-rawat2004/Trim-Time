# Trim-Time: Audit and Security Specification

Status: planned safeguards for the agreed features. Audit records support debugging and accountability; they do not introduce an analytics or administrator product feature.

## Authentication

- Use Spring Security and an adaptive password encoder; never store plaintext passwords.
- Normalize account identifiers consistently and enforce uniqueness in MySQL.
- Avoid revealing whether an account exists through login failures.
- Rotate session identity on authentication and invalidate it on logout.
- Use HttpOnly cookies, Secure in HTTPS deployment, appropriate SameSite configuration, and CSRF protection.
- Define idle session timeout during setup and document restart behavior.
- Apply bounded login throttling appropriate to the deployment; mechanism is to be selected.

## Authorization

Enforce CUSTOMER, BARBER, and SALON_OWNER plus ownership/assignment. Check current membership rather than trusting client fields or permanently cached session roles. Reject arbitrary privileged roles at registration. Use the [access architecture](07-Access-Removal-Architecture.md) as the permission baseline.

## Input and data integrity

Finalized onboarding: self-registration grants CUSTOMER only; the applicant selects a salon and its owner approves/rejects the request. Pending applications must not expose customer appointment data. Read authorization from active membership, not an applicant's profile or chosen salon ID. Record approval/rejection/withdrawal, owner self-enrollment, and membership removal with actor, target, outcome, and timestamp. Do not collect identity documents for this MVP.

One account may hold multiple roles, but one owner owns at most one salon and a barber has at most one active salon membership. Enforce limits transactionally and with database uniqueness safeguards. Membership removal revokes only the relevant barber authority, preserving independent roles. Repeated or concurrent approvals must not bypass these limits.

- Validate dates, coordinates, radius bounds, pagination, durations, prices, and text lengths.
- Use parameterized repository queries; do not concatenate client input into SQL.
- Recompute booking price, duration, customer identity, status, and permissions server-side.
- Escape displayed user content; do not render salon descriptions as unchecked HTML.
- Enforce transactions and consistent locking for booking-related writes.
- Return controlled error objects without stack traces, SQL, secrets, or internal filesystem paths.

## Photo uploads

- Allow only a small explicit set of image formats, with size/count/dimension limits decided before implementation.
- Check actual file content, not only extension or supplied content type.
- Generate storage keys; reject path traversal and user-controlled storage paths.
- Store outside executable/application source locations and do not allow script execution.
- Scope upload/delete permissions to the salon owner.
- Handle metadata/file inconsistencies with cleanup and clear errors.

## Audit and operational records

| Record | Minimum useful data |
| --- | --- |
| Booking created | Booking ID, actor ID, timestamp, initial status |
| Booking status changed | Booking ID, actor, old/new status, reason, timestamp |
| Permission/staff change | Actor, target, action, timestamp, outcome |
| Security failure | Request correlation ID, action category, outcome; minimal identity metadata |
| Application error | Correlation ID, error category, safe diagnostic context |

Persist booking history in the same transaction as the change. Security and staff-change audit storage beyond ordinary structured logs is a proposed implementation detail to finalize; no audit viewer is promised.

Never log passwords, session cookies, CSRF tokens, full authentication headers, or unnecessary personal data. Do not record customer search coordinates by default. Restrict logs and backups to authorized operators.

## Container and configuration security

- Keep credentials out of Git, Dockerfiles, images, and committed Compose configuration.
- Use an application database account with limited privileges; migrations may use a separately configured account.
- Keep MySQL on the internal Compose network; production should not expose its port publicly.
- Use non-root application containers where practical and pinned dependency/image versions.
- Configure HTTPS at the deployment boundary before handling real accounts.
- Keep database and photo backups separate from volumes and test restoration before a real deployment.

## Required security evidence

Verify rejected unauthenticated writes, missing/invalid CSRF protection, cross-record access attempts, privileged-role injection, stale membership, invalid uploads, SQL-like input handling, and accidental sensitive fields in responses/logs. Test successful authorized flows too.

No claim of completed security testing or production readiness is made by this document.
