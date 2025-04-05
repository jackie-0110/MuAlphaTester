-- Drop existing leaderboard function and trigger
drop trigger if exists update_leaderboard_trigger on public.practice_attempts;
drop function if exists public.update_leaderboard();

-- Create improved leaderboard update function
create or replace function public.update_leaderboard()
returns trigger as $$
declare
  stats record;
begin
  -- First calculate basic statistics
  with attempt_stats as (
    select 
      pa.user_id,
      p.username,
      p.grade_level,
      pa.division,
      pa.topic,
      count(*) as total_attempts,
      count(distinct pa.question_id) as unique_questions,
      count(distinct case when pa.is_correct then pa.question_id end) as correct_questions,
      count(case when pa.is_correct then 1 end) as total_correct
    from public.practice_attempts pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = new.user_id
      and pa.division = new.division
      and pa.topic = new.topic
    group by pa.user_id, p.username, p.grade_level, pa.division, pa.topic
  )
  select 
    user_id,
    username,
    grade_level,
    division,
    topic,
    total_attempts,
    case 
      when total_attempts > 0 then 
        (total_correct::float / total_attempts * 100)::numeric(5,2)
      else 0
    end as average_score,
    correct_questions as perfect_scores,
    unique_questions as questions_attempted
  into stats
  from attempt_stats;

  -- Update or insert into leaderboard
  insert into public.leaderboard (
    user_id,
    username,
    grade_level,
    division,
    topic,
    average_score,
    attempts,
    perfect_scores,
    questions_attempted,
    last_updated
  )
  values (
    stats.user_id,
    stats.username,
    stats.grade_level,
    stats.division,
    stats.topic,
    stats.average_score,
    stats.total_attempts,
    stats.perfect_scores,
    stats.questions_attempted,
    now()
  )
  on conflict (user_id, division, topic) 
  do update set
    average_score = excluded.average_score,
    attempts = excluded.attempts,
    perfect_scores = excluded.perfect_scores,
    questions_attempted = excluded.questions_attempted,
    last_updated = excluded.last_updated;

  return new;
end;
$$ language plpgsql security definer;

-- Add questions_attempted column to leaderboard
alter table public.leaderboard 
add column if not exists questions_attempted integer default 0;

-- Recreate the trigger
create trigger update_leaderboard_trigger
  after insert or update on public.practice_attempts
  for each row
  execute function public.update_leaderboard();

-- Update existing leaderboard entries
with attempt_stats as (
  select 
    pa.user_id,
    pa.division,
    pa.topic,
    count(*) as total_attempts,
    count(distinct pa.question_id) as unique_questions,
    count(distinct case when pa.is_correct then pa.question_id end) as correct_questions,
    count(case when pa.is_correct then 1 end) as total_correct
  from public.practice_attempts pa
  group by pa.user_id, pa.division, pa.topic
)
update public.leaderboard l
set 
  average_score = case 
    when s.total_attempts > 0 then 
      (s.total_correct::float / s.total_attempts * 100)::numeric(5,2)
    else l.average_score
  end,
  attempts = s.total_attempts,
  perfect_scores = s.correct_questions,
  questions_attempted = s.unique_questions
from attempt_stats s
where l.user_id = s.user_id
  and l.division = s.division
  and l.topic = s.topic; 