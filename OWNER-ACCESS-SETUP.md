# Owner login and SMS help

## Website
- Homepage footer now contains **Owner Login** pointing to `/owner.html`.
- Owner sign-in has username `iboyr` and a password field; this username maps to the verified Supabase Auth email `ben.rahm@gmail.com`.
- The public configuration contains **only** a publishable API key, email mapping, and public function URLs. No password or private service key is stored in GitHub.
- The server checks a valid Supabase JWT, requires a verified email, and authorizes only addresses in `public.website_owner_emails` before allowing review edits.

## Required owner account activation (NOT yet complete)
Supabase Auth currently has no users in this project. A real password login cannot work until an account exists.

1. In Supabase project `mltkksvlgvkqudrbnscv`, open **Authentication → Users** and create/invite a user with email `ben.rahm@gmail.com`. Set a fresh strong password **inside Supabase**, not in source control or chat.
2. Confirm the address. The backend rejects unconfirmed email identities for owner actions.
3. Set the Auth allowed site/redirect URL to `https://tallandsmallyardwork.com/owner.html` for email reset and recovery links if needed.
4. Sign in at `https://tallandsmallyardwork.com/owner.html` using username `iboyr` and the chosen password, and verify review edits with a harmless test review.
5. When Julia needs access, give her **her own** Supabase Auth user and add her verified email to the allowlist (with permission). Do not share passwords.

## SMS
`HELP` or `COMMANDS` returns a short photo-command cheat sheet. `REVIEW` explains review reply workflow. Both require the existing verified Twilio sender + webhook signature; no owner URL in the response, since Owner Login is visible in the footer.

### Testing
- Check `HELP` with and without an active customer review to ensure it never becomes a draft customer reply.
- Check `REVIEW` for independent help.
- Check `POST` still publishes only a photo job; `YES` still confirms only a pending review reply.
- Check anonymous and ordinary signed-in users cannot PATCH `reviews`; only verified allowlisted owner users can.
