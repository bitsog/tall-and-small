# Our Work — MMS photo gallery (November 2026)

This implementation uses the **existing** Twilio review-only number `+15716484077` for **owner-only** photos, while keeping David's public customer number `+15719195767` unchanged. The signed Twilio webhook and exact sender verification remain mandatory. Only messages from `DAVID_NOTIFY_NUMBER` are processed; Julia's separate phone is **not** authorized for SMS yet.

## David's simplest photo workflow

**AFTER-only job:** Text `AFTER`; send one or more pictures (one or several MMS messages); text `DONE`; review the confirmation and text `POST` to publish.

**BEFORE and AFTER:** Text `JOB`; send BEFORE pictures; text `AFTER`; send AFTER pictures; text `DONE`; then text `POST`.

**Even easier:** Sending pictures without a current job automatically starts an AFTER-only draft.

Optional:
- `NAME Backyard Cleanup` changes the public title. Do not include an address, person's name, or other private information.
- `PHOTOS` tells David how many BEFORE and AFTER photos are in the current job.
- `HOLD` saves the current draft privately so a new job can be started; `RESUME` restores the held job if exactly one is held.
- `MORE` reopens the current job after DONE.
- Use `POST` for photo publication. A bare `YES` is **reserved for customer-review reply confirmations** and cannot publish photos. Do not use `START`, a carrier-reserved opt-in command.

## Data and privacy

Supabase stores drafts in a **private** bucket `yard-project-drafts`; photos are not visible until the signed owner confirms with POST. The server removes recognized embedded EXIF, GPS, XMP, and text metadata from JPEG, PNG and WebP before storing. Published copies are in `yard-project-public` and appear in the homepage **Our Work** section (GET-only `work-gallery` Edge Function). Projects are collections of multiple BEFORE or AFTER photos, not addresses or customer contact records.

The initial version supports a maximum of 24 photos per job, 8 media attachments per incoming message, and images under 5 MB each; images must arrive as JPEG, PNG or WebP. These are technical safeguards, not a requirement to upload all pictures at once. No customer PII is required or collected as structured data.

## Release/testing

- Database migrations `008_mms_work_gallery.sql` and `009_mms_idempotency.sql` create the schema, private/public storage buckets, and duplicate-MMS protection.
- The `review-sms` function handles signed photo commands and SMS without changing the Twilio inbound webhook URL.
- `work-gallery` Edge Function returns **only published projects**.
- Site displays AFTER-only projects and before/after galleries with multiple photos. No project appears until published.
- Database smoke queries confirmed both buckets, privacy flags, unique photo idempotency index and **zero test records** prior to the real-world test.
- **Still requires a live MMS test from David's registered phone**: receive → save draft → DONE → POST → public display, including after-only and multiple-photo sequence. Cannot claim carrier media download or rendering works until that test succeeds.
- Owner Portal remains unconfigured. Deleting, reordering and restoring projects through a UI should be implemented separately with authenticated owner/Julia roles, not exposed to the public.

## Operational safety

Use only non-sensitive project names and photos with permission. Before pressing POST, check images don't expose a customer's address, license plates, faces, or identifying details without consent. Public photo storage links are accessible to anyone once published. If content is inappropriate, an administrator should archive/delete it until the Owner Portal is operational.
