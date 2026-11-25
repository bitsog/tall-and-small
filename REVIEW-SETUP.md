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
