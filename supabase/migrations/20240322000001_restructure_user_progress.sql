-- Drop existing indexes
drop index if exists public.idx_user_progress_user_id;
drop index if exists public.idx_user_progress_division_topic;
drop index if exists public.idx_user_progress_completed_at;

-- Create temporary table with new structure
create table public.user_progress_new (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  division text not null,
  topic text not null,
  grade_level text not null,
  session_id text not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  type text not null check (type in ('practice', 'test')),
  -- Add unique constraint to prevent duplicate sessions
  unique (user_id, session_id)
);

-- Copy data from old table to new table
insert into public.user_progress_new (
  id,
  user_id,
  division,
  topic,
  grade_level,
  session_id,
  completed_at,
  type
)
select 
  id,
  user_id,
  division,
  topic,
  grade_level,
  gen_random_uuid()::text as session_id,
  completed_at,
  type
from public.user_progress;

-- Drop old table
drop table public.user_progress;

-- Rename new table to old table name
alter table public.user_progress_new rename to user_progress;

-- Create new indexes
create index idx_user_progress_user_id on public.user_progress(user_id);
create index idx_user_progress_session_id on public.user_progress(session_id);
create index idx_user_progress_completed_at on public.user_progress(completed_at);

-- Enable RLS
alter table public.user_progress enable row level security;

-- Create policies
create policy "Users can view their own progress"
  on public.user_progress for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own progress"
  on public.user_progress for insert
  with check ( auth.uid() = user_id ); 