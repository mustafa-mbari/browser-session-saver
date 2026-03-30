-- Migration 019: shared_prompts table for shareable prompt links
create table if not exists shared_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_title text not null,
  prompt_content text not null,
  prompt_description text,
  tags jsonb not null default '[]',
  compatible_models jsonb not null default '[]',
  shared_by_user_id uuid references auth.users(id) on delete set null,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table shared_prompts enable row level security;

create policy "Anyone can read shared prompts"
  on shared_prompts for select using (true);

create policy "Anyone can insert shared prompts"
  on shared_prompts for insert with check (true);

create policy "Anyone can increment view_count"
  on shared_prompts for update using (true) with check (true);
