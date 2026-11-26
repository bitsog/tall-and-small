# Tall and Small Yard Work reviews

## Scope

Customers can submit a **name, 1–5 star rating, comment, and submit**. The form does not ask for a phone number, email address, or consent to receive text messages. It does not send SMS to customers. Reviews become public after the server verifies Turnstile and the abuse controls.

The Twilio number is only for David's review notifications and for David to submit public replies by text. Job inquiries continue to use David's existing public number, **(571) 919-5767**.

## Current setup

- Supabase project: `mltkksvlgvkqudrbnscv` (active).
- Migrations 001–005 are applied; review, SMS idempotency, and rate-limit tables have RLS enabled. Public reads are limited to published reviews; write and private workflow tables have no public policies.
- Edge Functions `reviews` and `review-sms` are deployed. `reviews` handles public reads and submissions; `review-sms` validates signed Twilio webhooks and David's two-step replies.
- The public site configuration points to the Supabase `reviews` endpoint. The public Turnstile site key is in `review-settings.js`; the matching Cloudflare widget/secret still needs live verification.
- Review submission stays off until the real Turnstile secret, rate-limit salt, and end-to-end checks are complete.
- SMS stays off separately until carrier approval and a controlled, successful reply test. A2P Brand is approved; Sole Proprietor Campaign is submitted and **IN REVIEW**. Messaging Service: `Tall and Small Reviews`; SMS number: `+15716484077`.

## Server-side configuration

Set private Supabase Edge Function secrets only in Supabase. Never put a secret in GitHub or browser JavaScript.

- `TURNSTILE_SECRET_KEY`: Cloudflare secret matching the site's configured public Turnstile site key.
- `REVIEW_RATE_SALT`: random value of at least 32 characters.
- `REVIEW_SUBMISSIONS_ENABLED`: keep unset/false until testing is complete; set `true` only for the review launch.
- `REVIEW_SMS_ENABLED`: keep unset/false while SMS is waiting on registration approval and end-to-end testing.
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

No code path sends a text unless `REVIEW_SMS_ENABLED=true`. Do not enable that flag before A2P Campaign approval and controlled testing. The SMS daily cap is 20 notifications; it limits message count, not total charges.

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

## Tests before public launch

1. Run the repository's Node tests for review validation and simple form behavior.
2. Verify Cloudflare's real site key renders for `tallandsmallyardwork.com` and `www.tallandsmallyardwork.com`; verify a real token server-side.
3. With reviews still off, verify GET reads published reviews, malformed submissions fail, honeypot submissions do not write, and a valid submission is blocked while the feature flag is off.
4. Enable reviews only after the prior checks, submit a controlled test review, verify public rendering and that no contact fields are accepted or stored, then remove the test review.
5. Verify the 4th submission in one hour is rejected.
6. Keep SMS disabled until the Campaign leaves IN REVIEW. Then test an alert and David's REPLY/YES flow using an agreed controlled review; test bad signature, wrong sender, wrong/expired code, duplicates, and cap behavior.
7. Do not merge PR #2 or enable live SMS until these tests pass.

## Not launch blockers for the customer form

David's owner dashboard sign-in is optional for the requested SMS reply workflow. It requires setting up David's authorized Supabase Auth account and `REVIEW_OWNER_USER_ID` if the dashboard is kept in use.
