# Tall and Small Yard Work reviews

## Scope

Customers can submit a **name, 1–5 star rating, comment, and submit**. The form does not ask for a phone number, email address, or consent to receive text messages. It does not send SMS to customers. Reviews become public after the server verifies Turnstile and the abuse controls.

The Twilio number is only for David's review notifications and for David to submit public replies by text. Job inquiries continue to use David's existing public number, **(571) 919-5767**.

## Current status — November 27, 2026

- The automatic review form is published on the existing `main` website. Cloudflare Turnstile and a controlled end-to-end review POST were tested successfully on the production hostname. The test review was deleted and verified absent.
- Supabase project `mltkksvlgvkqudrbnscv` is active; migrations 001–005 are applied. RLS protects the review and private SMS workflow tables.
- The deployed `reviews` and `review-sms` Edge Functions are active. Their source is committed in this repository.
- The public site key and the private Turnstile verification worked during a real review submission; both apex and www website hostnames are configured.
- Owner confirmed saving `REVIEW_SUBMISSIONS_ENABLED=true` and `REVIEW_SMS_ENABLED=true` in Supabase. Secret values cannot be retrieved directly for independent confirmation.
- The A2P campaign was approved by Twilio November 27, 2026; the Twilio account showed Active with a $24 prepaid balance.
- **SMS is enabled but the live notification, Messaging Service sender assignment, incoming webhook, and David's REPLY/YES cycle have not yet been verified end-to-end. Do not claim SMS is tested or fully launched until those checks pass.**
- Existing public number `(571) 919-5767` remains unchanged. Dedicated review SMS number: `+15716484077`.
- PR #2 was merged after reconciling the index.html branch conflict without changing the deployed homepage. Obsolete PR #3 was closed.

## Server-side configuration

Set private Supabase Edge Function secrets only in Supabase. Never put a secret in GitHub or browser JavaScript.

- `TURNSTILE_SECRET_KEY`: Cloudflare secret matching the site's configured public Turnstile site key.
- `REVIEW_RATE_SALT`: random value of at least 32 characters.
- `REVIEW_SUBMISSIONS_ENABLED`: owner reported setting `true` after successful controlled review submission test.
- `REVIEW_SMS_ENABLED`: owner reported setting `true` after A2P approval; SMS delivery/webhook/reply verification remains outstanding.
- `PUBLIC_SITE_ORIGIN=https://tallandsmallyardwork.com`
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function runtime.

The review endpoint verifies Turnstile server-side for the Tall and Small hostnames and limits each keyed network to 3 accepted submissions per hour. It stores only the name, rating, comment, and review metadata. It uses the `cf-connecting-ip` header and stores only a salted HMAC, not the raw IP.

## Twilio-only configuration

Private secrets required before activating SMS:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER=+15716484077`
- `DAVID_NOTIFY_NUMBER` (David's confirmed mobile in E.164 format)
- `TWILIO_WEBHOOK_URL=https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms` is set as a non-secret URL; verify the exact value in Supabase before using it.

No code path sends a text unless `REVIEW_SMS_ENABLED=true`. A2P is approved and the owner reports the flag enabled, but the live messaging integration has not been tested. The SMS daily cap is 20 notifications; it limits message count, not total charges.

## David's reply workflow

When enabled, David receives an alert with a review code, rating, customer name, and comment. He replies to the dedicated Twilio number:

```text
REPLY <review-code> <his response>
```

The service sends him a preview. He confirms within 15 minutes by replying:

```text
YES <review-code>
```

The reply appears beneath that review. The webhook accepts only Twilio-signed requests from David's confirmed number and ignores duplicate MessageSids. No general customer conversations are routed through this number.

## Verification record and remaining tests

- **Passed:** Browser Turnstile success, real backend submission, database persistence, public display, and cleanup of test review.
- **Passed:** Production homepage retains existing public contact links; project source is merged in `main`.
- **Not yet verified:** 4th submission in one hour returns HTTP 429 (rate-limit cap).
- **Not yet verified:** Twilio number `+15716484077` belongs to the approved Messaging Service sender pool and incoming SMS webhook is configured to the exact `review-sms` endpoint.
- **Not yet verified:** Signed incoming webhook, permitted David sender, malformed/expired codes, duplicate message handling, and controlled alert → REPLY → YES → published owner reply. Do not fabricate a test result.
- **Before inviting customers:** Confirm owner destination and SMS delivery. Avoid sending unnecessary live SMS.

## Not launch blockers for the customer form

David's owner dashboard sign-in is optional for the requested SMS reply workflow. It requires setting up David's authorized Supabase Auth account and `REVIEW_OWNER_USER_ID` if the dashboard is kept in use.
