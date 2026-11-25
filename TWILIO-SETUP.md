# Twilio activation — Tall and Small review texts only

This project uses **a dedicated Twilio SMS number for David's review notifications/replies**, not the existing public business number. Customer calls, estimates, appointments, and conversations still go directly to David at **(571) 919-5767**.

## 1. Create/upgrade a Twilio account
- Twilio sign-up: https://www.twilio.com/try-twilio
- Twilio Console: https://console.twilio.com/
- For US pay-as-you-go billing, Twilio lists card payments and, in some cases, PayPal. Direct ACH/bank debit is generally for invoiced accounts, not ordinary PAYG. Set payment information **inside Twilio**; don't send it to ChatGPT or commit it to GitHub.
- Choose a low initial prepaid balance and disable auto-recharge until spending is understood.
- Search for a local, SMS-capable phone number. Lease it only after pricing is shown and approved.
- Register an eligible A2P 10DLC business brand and campaign (or select an eligible alternative). Do not assume Sole Proprietor eligibility: it requires specific business/Tax ID conditions. Carrier review may take days.
- Use case: **transactional operational SMS notifications to the business owner about new reviews posted at https://tallandsmallyardwork.com/; owner may reply to publish a response under each review. No customer marketing, solicitation, or automated texts to customers.**
- Consent: David must specifically opt in to receive system alerts at his own mobile number; keep evidence. Verify his receiving phone number.
- Some Twilio requirements may require identifying the business operator, actual opt-in steps and sample messages. Enter true information.

## 2. Webhook for inbound texts
Configure "A message comes in" for the dedicated Twilio number:
- Method: HTTP POST
- URL: `https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms`
- Content type: `application/x-www-form-urlencoded`
- The handler validates the Twilio signature using the configured URL, accepts only replies sent **from David's verified mobile number**, and requires two-step confirmation.

## 3. Supabase Edge Function secrets
Supabase dashboard: https://supabase.com/dashboard/project/mltkksvlgvkqudrbnscv/functions
Set these private server-side secrets for **both** deployed functions. **Never put them in `review-settings.js`, `owner-settings.js`, source code, or chat messages**:

```dotenv
TWILIO_ACCOUNT_SID=<Twilio Account SID>
TWILIO_AUTH_TOKEN=<Twilio Auth Token>
TWILIO_FROM_NUMBER=<purchased Twilio E.164 number>
DAVID_NOTIFY_NUMBER=<David's confirmed E.164 mobile number>
TWILIO_WEBHOOK_URL=https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms
PUBLIC_SITE_ORIGIN=https://tallandsmallyardwork.com
REVIEW_RATE_SALT=<independently generated random 32+ character value>
TURNSTILE_SECRET_KEY=<Cloudflare Turnstile secret>
REVIEW_OWNER_USER_ID=<David's Supabase Auth user ID, optional for SMS-only reply workflow>
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to managed Edge Functions automatically. Confirm availability before activation.

SMS activation cannot be completed until Twilio and the registration are ready.

## 4. Spam protection and website configuration
- Create a free Cloudflare Turnstile widget for `tallandsmallyardwork.com` and `www.tallandsmallyardwork.com`: https://dash.cloudflare.com/?to=/:account/turnstile
- Put **public** site key in `review-settings.js` `TALL_SMALL_TURNSTILE_SITEKEY` (GitHub).
- Put **private** secret in Supabase Edge Function secrets, not GitHub.
- Site's `TALL_SMALL_REVIEWS_API` in `review-settings.js`:
  `https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/reviews`
- The backend keeps `REVIEW_SUBMISSIONS_ENABLED` **off** by default. Enable only after Turnstile keys are verified and the public form successfully passes end-to-end tests.
- Review frequency limit: 3 submissions per network key per hour. Outbound review SMS capped at 20 per UTC day. Each long SMS may be billed as multiple segments. Do not treat daily SMS cap as a financial spending limit, as carrier charges vary.

## 5. David's exact interaction
New review alert:
```
Tall and Small review a1b2c3d4e5: 4/5 stars from Jennifer: Great job.
Reply by text: REPLY a1b2c3d4e5 Your message
Then confirm with YES a1b2c3d4e5.
```
David responds:
```
REPLY a1b2c3d4e5 Thank you, Jennifer! I appreciate your business.
```
System texts a preview, then David sends:
```
YES a1b2c3d4e5
```
His response is then visible below that exact review on the website. Review codes above are examples only. Confirmation expires after 15 minutes.

## 6. Verification checklist
- Test review submission using a real Turnstile challenge, and verify it appears publicly.
- Test anonymous reads and ensure private contact info is excluded.
- Test the 4th submission blocked by rate limiter.
- Test SMS notification delivery and actual inbound webhook.
- Test proper review code, wrong sender number, bad webhook signature, expired confirmation, duplicate MessageSid and duplicate reply.
- Test a negative review and polite public owner reply.
- Test carrier approval and budget cap, and confirm no texts are sent to customers.
- Only then merge GitHub PR #2 into main and verify the GitHub Pages deployment.

## Published pricing references (November 2026; confirm at checkout)
- https://www.twilio.com/en-us/sms/pricing/us : US leased SMS long-code number $1.15/month; outgoing/incoming SMS $0.0083 **per segment** before applicable carrier fees.
- https://www.twilio.com/en-us/phone-numbers/a2p-10dlc : Sole proprietor (if eligible) $4 brand + $15 vetting one-time, $2/month campaign. Other registrations may cost more.
- https://help.twilio.com/articles/49507358452635 : PAYG payment methods differ from invoiced ACH.
- Regulatory approval may take several days. No instant activation guarantee.

## Current status
The Edge Functions `reviews` and `review-sms` and backing SQL migrations are deployed in the BITSOG project `mltkksvlgvkqudrbnscv`. They are not accepting live review submissions or processing inbound SMS without configuration. No Twilio number has been purchased, no account billing has been set up, and PR #2 is intentionally unmerged.
