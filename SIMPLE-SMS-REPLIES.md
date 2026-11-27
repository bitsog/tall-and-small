# Simple SMS replies (draft rollout)

The current production SMS reply protocol uses a ten-character review code, `REPLY code message` and `YES code`. This branch adds a **separately gated** replacement that lets David respond normally.

## David's experience (when enabled)
1. A new review is queued. If there is no active review, David receives its rating, customer name and comment and the prompt to reply naturally.
2. He sends `Thank you, Michael! It was a pleasure working with you.`
3. The system stores a private draft for 15 minutes and sends a preview identifying Michael.
4. He sends **YES** to publish under that exact review, **NO** to discard only the draft, or **SKIP** to move to the next queued review without replying.
5. Only one review may be active at a time. Additional reviews wait and are presented individually after the previous review is published or skipped.
6. HELP or STATUS resends the active-review context; opt-out keywords are never treated as drafts. Only a cryptographically signed webhook from David's designated phone number is processed.
7. No customer receives SMS. David's publicly advertised phone number stays unchanged.

## Rollout and verification
- The new `review_sms_queue` table and service-role-only RPC functions `enqueue_review_sms` and `advance_review_sms` are added in migration 006.
- The new code is deployed to Supabase but disabled by `REVIEW_SIMPLE_SMS_ENABLED` (unset is treated as false). Existing `REVIEW_SMS_ENABLED` retains its independent behavior.
- Confirmed: transactional SQL simulation of two reviews advanced the queue; transaction rolled back, zero test rows remain.
- Confirmed: eight local Node parser checks passed, including confirmation, cancellation, SKIP, reserved keywords, and rejecting old coded replies.
- **Not yet confirmed:** A Twilio-origin signed inbound-message test, customer notification, David's natural reply → YES exchange, SMS queue under concurrent real submissions, and message delivery during provider errors.
- Do not set `REVIEW_SIMPLE_SMS_ENABLED=true` or mark this fully operational until these live tests pass.
- No new purchases or subscription changes are required for this code.
- For safety, new simple replies are never published until the valid sender confirms with YES.

## Twilio billing
The Twilio auto-recharge balance threshold and top-up amount are configurable but **not a monthly hard cap**. Set usage alerts separately in Twilio, and use application-side SMS limits to constrain outgoing alerts. The existing `reserve_review_sms_alert` enforces 20 outbound messages per day but does not cap all Twilio charges or carrier fees.
