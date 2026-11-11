# Membership module

API contract: `docs/MEMBERSHIP_API_CONTRACT.md`. Design source: `static-kdl-os/membership/docs/5-build-notes/`.

## Local testing of mobile OTP
The OTP code is delivered by SMS / WhatsApp / e-mail through the Integrations module. With no provider configured
(or for local testing) the API can return the code in the `send` response as `dev_code`. This is **fail-closed**:
it only happens when BOTH are set on the backend process:

    NODE_ENV=development
    OTP_DEBUG_RESPONSE=true      # docker compose: add under the backend service `environment:`

In every other case (unset, test, staging, production) `dev_code` is never returned and the code is not logged.

## Communication
Every audit event written by `util.recordEvent` is queued (BullMQ queue `membership-comm`), mapped to the 44
communication events (`comm/eventmap.js`), and expanded into one log row + one delivery job per channel
(job id `event_id-CHANNEL`). In-App rows are core `notifications` (category `membership`); Email / WhatsApp / SMS go
through `integrations` `dispatchMessage`. The daily job (default 10:00 IST) runs `runExpirySweep()` and then the
renewal reminders.
