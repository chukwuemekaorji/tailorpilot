-- run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- adds the "your details" fields to user_settings - a real name/contact
-- block for exported cvs and cover letters, instead of just the cv's
-- internal dropdown label as the document title.

alter table user_settings
  add column if not exists full_name text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists location text;
