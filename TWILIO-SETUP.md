# Twilio — Tall and Small review notifications only

## Current status

- Twilio account is active with a $20 prepaid balance.
- SMS-capable number: `+15716484077`.
- Messaging Service: `Tall and Small Reviews`.
- A2P Brand: **Approved**.
- Sole Proprietor Campaign: **Submitted — IN REVIEW**.
- The customer-facing public number remains **(571) 919-5767** for job calls and texts. Do not replace or forward it through Twilio.
- No customer phone/email collection or customer SMS enrollment. The dedicated number is only for notifications to David and replies from David.

Do not send test or customer traffic until carrier registration is approved. Do not buy additional numbers, add funds, or turn on auto-recharge without approval.

## Inbound webhook

After setting the private secrets, configure the dedicated number or its Messaging Service inbound SMS handler:

- Method: HTTP POST
- URL: `https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms`
- Content type: `application/x-www-form-urlencoded`

The function checks Twilio's request signature against the exact configured URL and accepts only David's confirmed sender number.

## Private Supabase secrets

Set secrets through the Supabase dashboard. Never put them in GitHub, website JavaScript, logs, or chat.

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER=+15716484077`
- `DAVID_NOTIFY_NUMBER` — David's confirmed mobile in E.164 format
- `TWILIO_WEBHOOK_URL=https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/review-sms`
- `REVIEW_SMS_ENABLED=false` until campaign approval and controlled end-to-end testing

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the deployed functions. Keep `REVIEW_SMS_ENABLED` off while the campaign is IN REVIEW. The review form can be launched independently because its SMS integration is separately gated.

## David's interaction after SMS is activated

Notification format:

```text
Tall and Small review <code>: <rating>/5 stars from <name>: <comment>
Reply: REPLY <code> <your message>
Confirm: YES <code>
```

David texts `REPLY <code> <message>`, checks the preview returned by Twilio, and texts `YES <code>` within 15 minutes. Only then is his response published under that review. Duplicate inbound message IDs do not repeat the action.

## Charges

No additional charges are approved by this document. Twilio usage includes the number's monthly rental and per-message segment/carrier fees. The database limit of 20 notification messages per day is not a dollar-denominated spend cap. Review-only SMS must stay off until the A2P Campaign is approved and the test flow has passed.
