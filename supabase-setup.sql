-- Sideline Command: optional Supabase sync
-- Run this once in your Supabase project's SQL Editor.
-- Then set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in index.html.

create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table app_state enable row level security;

-- The anon key ships in the browser, so these policies make the table
-- readable/writable by anyone who has your site URL and opens dev tools.
-- Fine for a practice planner; keep player identities to first name + number,
-- or put Netlify password protection in front of the site.
create policy "anon read"   on app_state for select to anon using (true);
create policy "anon insert" on app_state for insert to anon with check (true);
create policy "anon update" on app_state for update to anon using (true);
