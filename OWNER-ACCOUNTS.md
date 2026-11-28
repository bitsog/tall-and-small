# Owner Portal: three independent username/password accounts

The Owner Portal uses Supabase Auth for password verification. It accepts **usernames** `ben`, `david`, and `julia`. Each maps to a **separate** email/password identity in the same Supabase project. The alias mapping is for convenience only; the backend still verifies the Supabase JWT and checks the private owner allowlist for write access.

| Username | Supabase Auth email | Recovery destination |
| --- | --- | --- |
| ben | ben.rahm@gmail.com | Ben's Gmail |
| david | ben.rahm+tallsmall-david@gmail.com | Ben's Gmail |
| julia | ben.rahm+tallsmall-julia@gmail.com | Ben's Gmail |

Gmail plus addressing routes messages addressed to each of these aliases into the same original Gmail inbox. **Do not use the original Supabase dashboard account password** except if you independently chose the same password when creating the website identity. Accounts under Authentication > Users are separate identities.

## Setup actions
1. **Keep the existing confirmed** `ben.rahm@gmail.com` **user**; do not delete it. If its password fails, use password recovery. The old username `iboyr` is no longer used.
2. In Supabase project `mltkksvlgvkqudrbnscv` > Authentication > Users > Add user > Create new user, create the **David** identity with `ben.rahm+tallsmall-david@gmail.com` and a unique strong password. Set its email to confirmed using the dashboard option if available, or complete confirmation via Ben's inbox. Create directly rather than sending an invitation.
3. Repeat for **Julia** with `ben.rahm+tallsmall-julia@gmail.com` and another unique password. Neither alias requires David's or Julia's personal email, and no invitation need be sent to them.
4. Sign into `https://tallandsmallyardwork.com/owner.html` with each username and its corresponding **website account password**. The backend currently allows each configured identity to manage customer reviews. Photo editing/removal UI is not built yet.
5. Password recovery: enter the person's username at Owner Login, click Reset password, and look for an email to Ben. Before using it, verify Auth URL Configuration permits `https://tallandsmallyardwork.com/owner.html` as a redirect URL.
6. When David or Julia wants their own email recovery, update that identity's Supabase Auth email **and** the username mapping **and** the private allowlist, then confirm the new address. Do not simply overwrite a username alias with an unverified email.

## Security
- Passwords are only stored/verified by Supabase Auth, never in client code, GitHub, or ChatGPT.
- The public username mapping is not access authorization: server-side actions demand a real JWT from the signed-in identity and an allowlisted, confirmed email.
- All password recovery for these accounts is controlled by Ben, which is intentional for this initial setup. Anyone with access to Ben's email may be able to reset the other users' passwords. Protect Ben's Gmail account with its own strong authentication.
- There is no need to create new Gmail inboxes or add David's or Julia's personal email addresses.
- Creating a user is not complete until that user can successfully sign in. Test each identity separately.
- The Twilio registered sender for photo SMS remains David's specific phone number. Website owner login does not automatically authorize Julia's phone to send MMS.
