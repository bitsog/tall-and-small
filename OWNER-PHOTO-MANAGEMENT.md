# Our Work — owner photo management

Website `/owner.html` now has an **Our Work — photo projects** section, visible after Supabase Auth login. It uses the `work-owner` Edge Function.

### Supported actions
- **Rename** a project with a general 3–70-character title; avoid client names, addresses, and personal details.
- **Hide photo** removes its public Storage object (if present) and records `hidden_at`; the private draft original remains. **Restore photo** brings it back if its project is published.
- **Archive job** removes public photo copies and removes the project from public gallery. Private originals stay intact.
- **Restore job** republishes visible photos, or recovers an unpublished draft as a draft/held project depending on whether another SMS job is already active.
- Hidden photos and archived projects are omitted from `work-gallery`; the UI previews private originals via **10-minute signed URLs** available only from the authenticated management endpoint. Old publicly cached photo URLs might remain accessible until CDN caches expire.

### Security
Every `work-owner` GET and PATCH verifies Supabase Auth bearer access token, confirmed email, and private `website_owner_emails` allowlist. Neither the client-side username aliases nor a public API key alone authorize actions. RLS remains enabled and public storage writes are service-role only. No service role key is sent to a browser.

### Important scope notes
The Owner Portal does not yet upload/replace individual photos directly from a browser; **SMS remains the upload path**. The first implementation provides correction by hiding/archiving photos or jobs, and lets users rename projects. Truly permanent deletion and reordering have been intentionally deferred to prevent accidental data loss.

### Testing without bothering David
1. Verify migrations and policies via read-only SQL.
2. Deploy `work-owner` and revised `work-gallery` functions.
3. Confirm no original jobs/reviews were altered.
4. Verify frontend references `work-owner`, and owner JWT is included in all calls.
5. Do NOT send real SMS, create real customer reviews, publish fabricated jobs, or change Twilio billing.
6. Final integration checks still require a real incoming MMS and an authorized browser session for one hide/restore/archive action.
