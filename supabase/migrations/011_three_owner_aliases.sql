-- Distinct Supabase Auth identities for authorized Tall and Small operators.
-- Gmail plus-address aliases route recovery messages to Ben, not to David or Julia.
-- No accounts or passwords are created by this migration.
insert into public.website_owner_emails(email)
values
 ('ben.rahm+tallsmall-david@gmail.com'),
 ('ben.rahm+tallsmall-julia@gmail.com')
on conflict(email) do nothing;
