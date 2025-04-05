-- Drop existing leaderboard table
drop table if exists public.leaderboard;

-- Create new leaderboard table
create table public.leaderboard (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  username text not null,
  grade_level text not null,
  division text not null,
  topic text not null,
  average_score numeric(5,2) not null,
  attempts integer not null,
  perfect_scores integer not null,
  avg_time_taken integer,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Add unique constraint
  unique (user_id, division, topic)
);

-- Create indexes for leaderboard
create index idx_leaderboard_user_id on public.leaderboard(user_id);
create index idx_leaderboard_division_topic on public.leaderboard(division, topic);

-- Enable RLS for leaderboard
alter table public.leaderboard enable row level security;

-- Create policies for leaderboard
create policy "Leaderboard is viewable by everyone"
  on public.leaderboard for select
  using ( true );

create policy "Users can update their own leaderboard entries"
  on public.leaderboard for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own leaderboard entries"
  on public.leaderboard for update
  using ( auth.uid() = user_id );

-- Create function to update leaderboard
create or replace function public.update_leaderboard()
returns trigger as $$
declare
  user_stats record;
begin
  -- Calculate statistics from practice_attempts
  select 
    pa.user_id,
    p.username,
    p.grade_level,
    pa.division,
    pa.topic,
    avg(case when pa.is_correct then 100.0 else 0.0 end) as avg_score,
    count(*) as total_attempts,
    sum(case when pa.is_correct then 1 else 0 end) as perfect_scores
  into user_stats
  from public.practice_attempts pa
  join public.profiles p on p.id = pa.user_id
  where pa.user_id = new.user_id
    and pa.division = new.division
    and pa.topic = new.topic
  group by pa.user_id, p.username, p.grade_level, pa.division, pa.topic;

  -- Update or insert leaderboard entry
  insert into public.leaderboard (
    user_id,
    username,
    grade_level,
    division,
    topic,
    average_score,
    attempts,
    perfect_scores,
    last_updated
  )
  values (
    user_stats.user_id,
    user_stats.username,
    user_stats.grade_level,
    user_stats.division,
    user_stats.topic,
    user_stats.avg_score,
    user_stats.total_attempts,
    user_stats.perfect_scores,
    now()
  )
  on conflict (user_id, division, topic) do update
  set
    average_score = excluded.average_score,
    attempts = excluded.attempts,
    perfect_scores = excluded.perfect_scores,
    last_updated = excluded.last_updated;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for updating leaderboard
create trigger update_leaderboard_trigger
  after insert or update on public.practice_attempts
  for each row
  execute function public.update_leaderboard();

-- Update badges table to work with new structure
create or replace function public.check_badge_requirements()
returns trigger as $$
declare
  user_stats record;
begin
  -- Get user's statistics from practice_attempts
  select 
    count(distinct case when is_correct then question_id end) as correct_questions,
    count(distinct question_id) as total_questions,
    count(*) as total_attempts,
    avg(case when is_correct then 100.0 else 0.0 end) as avg_score
  into user_stats
  from public.practice_attempts
  where user_id = new.user_id
    and division = new.division
    and topic = new.topic;

  -- Check if user meets badge requirements
  if user_stats.avg_score < 80.0 then
    raise exception 'User does not meet badge requirements';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for badge requirements
create trigger check_badge_requirements_trigger
  before insert on public.user_badges
  for each row
  execute function public.check_badge_requirements(); 