-- run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- creates the "cvs" table: each user can save multiple named cvs (e.g.
-- "project manager cv", "software engineer cv") and pick one per job
-- posting from the extension, instead of pasting cv text every time.

create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cv_text text not null,
  created_at timestamptz not null default now()
);

alter table cvs enable row level security;

create policy "users can view their own cvs"
  on cvs for select
  using (auth.uid() = user_id);

create policy "users can insert their own cvs"
  on cvs for insert
  with check (auth.uid() = user_id);

create policy "users can update their own cvs"
  on cvs for update
  using (auth.uid() = user_id);

create policy "users can delete their own cvs"
  on cvs for delete
  using (auth.uid() = user_id);
