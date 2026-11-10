# Membership module — API contract (v1, shared by backend + frontend)

Design source: `/Users/f9developer/Development/static-kdl-os/membership/` (mockups + `docs/5-build-notes/`).
Schema: `backend/prisma/schema/membership.prisma` (migrated). Module slug `membership`, apiPrefix `/api/membership`.
All responses use `successResponse` → `{ success: true, data }` / `errorResponse`. Money = integer **paise**.
Lists: `?page=1&limit=20&q=&sort=` → `data: { items, total, page, limit }`.
Admin routes need `authenticate` + `requirePermission('membership', action)`; actions view/add/edit/delete/approve/export.

## Public (no auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/plans` | PUBLIC plans: plan + `prices[]` (active) + `benefits[]`, ordered by sort |
| GET | `/join-form/:planSlug?member_type=` | field packs (`groups[].fields[]`) the plan asks |
| POST | `/signup` | body `{ plan_slug, interval?, member_type, full_name, email, mobile, password, legal_name?, gstin?, fields?: {key:value} }` → creates User (role `member`, no admin access) + Member + Subscription (PENDING_PAYMENT, or ACTIVE if free+AUTO, or PENDING_APPROVAL if free+MANUAL). Returns `{ member, subscription, next: 'checkout'|'active'|'approval' }` and the standard auth tokens exactly like `/api/auth/login` does |
| POST | `/webhooks/:provider` | gateway webhook (idempotent via MembershipWebhookEvent) — Razorpay HMAC verify |

## Member area (`authenticate`; the user must own a Member row; else 403)
| Method | Path |
|---|---|
| GET | `/me` → `{ member, subscription, plan, contacts, fields }` |
| PUT | `/me` (core profile), PUT `/me/fields` ({key:value}) |
| GET/POST | `/me/contacts`; PATCH/DELETE `/me/contacts/:id` (max `plan.max_contacts`, one primary) |
| GET | `/checkout/providers?plan_slug=&interval=` → PUBLISHED providers matching plan/member type/amount |
| POST | `/checkout` `{ plan_slug, interval, provider_id, provider_option? }` → creates Payment; gateway: `{ payment, order }`; manual: `{ payment, instructions }` |
| POST | `/payments/:id/offline-proof` `{ utr, proof_url?, note? }` → UNDER_VERIFICATION |
| POST | `/payments/:id/confirm` gateway client-side confirm (verifies signature) |
| GET | `/me/payments`, `/me/invoices`, `/me/invoices/:id` |
| POST | `/me/renew`, `/me/change-plan` `{plan_slug, interval}` (upgrade now pro-rata; downgrade at renewal), `/me/cancel` `{reason?, immediately?}` |
| GET | `/me/access?path=/members/x` → `{ allowed, plan_required? }` |
| GET | `/me/library` → pages/media unlocked for the member's plan |

## Admin (`/admin/...`)
| Resource | Endpoints |
|---|---|
| overview | GET `/admin/overview` → KPIs (active, new 30d, MRR/revenue 30d, pending approvals, expiring 30d), growth series, plan mix, recent members |
| plans | GET/POST `/admin/plans`; GET/PATCH/DELETE `/admin/plans/:id` (delete only if no subscriptions else archive); POST `/admin/plans/:id/archive`; prices: POST `/admin/plans/:id/prices`, PATCH/DELETE `/admin/prices/:id`; benefits: PUT `/admin/plans/:id/benefits` (full ordered list); PUT `/admin/plans/:id/field-groups` `[ {group_id, member_type, required} ]`; PUT `/admin/plans/:id/access-rules` `[ {target,value,label} ]` |
| members | GET `/admin/members` (filters: status, plan_id, member_type, tag, member_since_from/to, valid_till_from/to, q), POST `/admin/members` (offline add; individual or organisation; optional plan + complimentary), GET/PATCH `/admin/members/:id`, POST `/admin/members/:id/{extend,change-plan,suspend,reactivate,cancel,record-payment,notes}`, contacts CRUD `/admin/members/:id/contacts[/:cid]`, GET `/admin/members/:id/activity`, POST `/admin/members/bulk` `{ids, action: tag|change-plan|export}`, GET `/admin/members/export?format=csv` |
| import | POST `/admin/members/import/preview` (rows + mapping → validation), POST `/admin/members/import/commit` |
| approvals | GET `/admin/approvals` (PENDING_APPROVAL), GET `/admin/approvals/:subscriptionId`, POST `…/approve`, POST `…/reject` `{reason, message?, refund?}` |
| payments | GET `/admin/payments` (status/provider/q), GET `/admin/payments/:id`, POST `…/verify`, POST `…/reject` `{reason}`, POST `…/refund` `{amount?}` |
| invoices | GET `/admin/invoices`, GET `/admin/invoices/:id`, POST `…/void` `{reason}` (issues credit note) |
| payment providers | GET/POST `/admin/payment-providers`, GET/PATCH/DELETE `…/:id` (delete only if unused else archive), POST `…/:id/{test,publish,hide,archive}`, PATCH `…/order` `{ids:[]}`. Credentials write-only: responses return `has_credentials: bool`, never secrets |
| field packs | GET/POST `/admin/field-groups`; PATCH/DELETE `/admin/field-groups/:id`; POST `/admin/field-groups/:id/fields`; PATCH/DELETE `/admin/fields/:id`; POST `/admin/field-groups/presets/apply` `{preset}` (Business, Professional, Education, Community, Residential, Club, Documents) |
| settings | GET/PUT `/admin/settings` → `{ general: {member_no_prefix, invoice_prefix, gst_rate_default, grace_days, renewal_rules, policies}, signup: {primary_login:'MOBILE_OTP'|'EMAIL', allow_email_password, require_approval_default, member_types} }` |

## Status machine
PENDING_PAYMENT → (payment PAID) → PENDING_APPROVAL (plan MANUAL) or ACTIVE → PAST_DUE (7-day grace) → EXPIRED; ACTIVE → CANCELLED / SUSPENDED; PENDING_APPROVAL → REJECTED (refund). First activation sets `member_since` + `member_no` (`KDL-M-{YYYY}-nnnnn`). Paid payment issues a GST invoice `MEM/{FY}/nnnnn` (FY Apr–Mar, gap-free, in a transaction). Every state change writes a `MembershipEvent` and `writeActivityAsync`.

## Out of scope for this pass (documented, not built)
Mobile OTP login, social login providers, WhatsApp/SMS communication system (phase 5), PhonePe/Cashfree/PayU/CCAvenue/Stripe/PayPal drivers (Razorpay + manual drivers only; the driver interface must allow adding the rest).
