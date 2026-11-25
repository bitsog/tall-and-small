# Review approvals — Tall and Small Yard Work

## Current workflow (free, no backend)
Visitors select 1–5 stars, type a first name and comments, then tap **Text my review to David**. On phones with SMS support, their messaging app opens with a prepared message to (571) 919-5767. They must press **Send**. On a desktop they can copy the message to send separately.

David receives the review as a normal customer text message. It **does not appear publicly** unless he approves it and the site maintainer adds it to `reviews.json` on GitHub.

## Approving and publishing
1. David reviews the incoming text and decides whether it is suitable to publish.
2. Confirm the customer's permission to publish their words and first name. Avoid personally identifying details.
3. Open `reviews.json` on branch `main`, click the edit pencil, and add the approved review to the JSON array:
```json
[
  {"name":"Example Customer","rating":5,"comment":"Example only — not a real review.","date":"2026-11-25"}
]
```
4. **Do not publish the example!** Use only genuine customer submissions. Commit the updated JSON; GitHub Pages will show it on the site.
5. For multiple entries, separate each object with a comma, keep the surrounding square brackets, and use ratings 1–5.

Avoid selectively showing only positive feedback in a way that misrepresents customer experiences.

## Important limits
This is a **customer-initiated SMS review request and manual moderation** workflow. It is not an automatic SMS gateway, server-side review form, or one-tap approval tool. GitHub Pages is static and cannot privately store submitted reviews, send automated SMS alerts, or let David securely approve them without extra infrastructure. Adding those features later requires a backend and an SMS service (typically paid), plus authentication and consent.
