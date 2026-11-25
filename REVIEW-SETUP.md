# Public customer reviews — pending backend connection

**Do not merge this branch until the checklist is complete.** The live GitHub Pages site currently retains the working customer-initiated SMS review workflow.

## Target behavior
- Customers submit a name, 1–5 stars, and a written review on the website.
- A verified backend stores the review, publishes it after automated abuse checks, and notifies David.
- Customers can optionally submit contact information privately and authorize follow-up.
- David signs into /owner.html to reply publicly, or remove reviews for spam/abuse (not merely because of negative ratings).
- Public reviews show the owner's reply nested below the original.

## Setup
1. Connect Supabase and create a project.
2. Run `supabase/migrations/001_reviews.sql`.
3. Deploy `supabase/functions/reviews/index.ts` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SITE_ORIGIN=https://tallandsmallyardwork.com`, and `REVIEW_OWNER_USER_ID`. The service role key stays private in Edge Function secrets.
4. Configure verified spam protection, e.g. Cloudflare Turnstile + server-side checks and per-IP rate limits. The function is purposely **disabled** for submissions until `REVIEW_SUBMISSIONS_ENABLED=true`. Do **not** set this true before implementing spam controls: the included honeypot alone is insufficient.
5. Set `review-settings.js` `TALL_SMALL_REVIEWS_API` to the HTTPS Edge Function URL.
6. Set `owner-settings.js` URL, public anon key, and API URL (NEVER service role).
7. Configure Supabase Auth email sign-in and allow the deployed /owner.html redirect URL. Set the owner user ID to David's authorized Supabase Auth account.
8. For automatic text alerts, configure a compliant Twilio account: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `DAVID_NOTIFY_NUMBER` as private function secrets. This requires separate Twilio account registration and can incur recurring/per-message charges.
9. Test real reviews, replies, spam blocking, notification delivery, and no exposure of customer contacts.
10. Merge the PR after tests pass and GitHub Pages deploys.

## Security and privacy
- Static GitHub Pages cannot accept submissions or send automated texts alone.
- The Edge Function must be protected against bots and repeated submissions before enabling submissions.
- Never put SMS credentials or the Supabase service-role key in browser-side JavaScript.
- Never publicly display optional customer contact information.
- Have David authorize an email address before enabling his private owner dashboard.
- Replies cannot be changed by site visitors; only the authorized Supabase owner ID can update them.
- The free database tier may suffice; SMS is not inherently free.


## REVIEW-ONLY two-way SMS (built; not activated)

The dedicated Twilio number is **exclusively** for review alerts and David's responses.
Customers still call/text David's existing number directly about jobs. Do not route general customer conversations through Twilio.

### Flow
1. Customer submits review to review API; after spam validation, it publishes and sends David an SMS.
2. Notification includes a unique 10-character code, rating, customer name, and comment.
3. David texts the Twilio number: `REPLY abc1234567 Thank you for the feedback!` (use actual code from alert).
4. System sends him a preview and asks for `YES abc1234567` within 15 minutes.
5. Upon confirmation, the reply appears publicly beneath that specific customer review; David receives a success SMS.
6. Repeated confirmations and duplicate webhook messages do not intentionally create new public replies. To edit an existing reply, use owner dashboard.

### Setup still needed
- Create/authorize a Twilio account, purchase a dedicated SMS-capable number, and complete appropriate US A2P 10DLC registration (may have setup, monthly and carrier fees). **Do not buy anything without the account owner's approval.**
- In Supabase Edge Function secrets set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DAVID_NOTIFY_NUMBER` (E.164; David's verified personal phone), and `TWILIO_WEBHOOK_URL=https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms`.
- Configure the dedicated Twilio number inbound SMS webhook to POST the exact `TWILIO_WEBHOOK_URL`. Signature verification requires URL match and all incoming form parameters. Verify real inbound SMS works before publishing.
- Deployments have been staged to Supabase with no paid credentials. Review submissions require `REVIEW_SUBMISSIONS_ENABLED=true`, which must **remain disabled until CAPTCHA and server-side rate limiting are implemented and tested**.
- Configure David's Auth account and `REVIEW_OWNER_USER_ID`, plus front-end settings, before merging this PR.
- Verify with a real controlled review and reply cycle, including negative review, duplicate webhook, wrong sender, wrong code, expiration, and missing SMS provider.

Security and operational limitations: SMS content is not end-to-end encrypted and is not appropriate for customer contact data. Only the designated sender number plus Twilio-signed webhook and text confirmation authorize replies. The UI and database keep optional private customer contact details separate. No SMS or review collection is currently active.

### Existing backend state (2026-11-25)
Supabase project `mltkksvlgvkqudrbnscv`, BITSOG free tier: migrations `001_reviews.sql`, `002_review_sms.sql`, `003_review_sms_codes.sql` applied; two Edge Functions `reviews` and `review-sms` deployed. Both public business workflows remain gated/disabled until service configuration.
