-- Create function to update user_progress
create or replace function public.update_user_progress()
returns trigger as $$
declare
  session_exists boolean;
begin
  -- Check if a session already exists for this attempt
  select exists(
    select 1 
    from public.user_progress 
    where user_id = new.user_id 
      and session_id = new.session_id
  ) into session_exists;

  -- If session doesn't exist, create a new entry
  if not session_exists then
    insert into public.user_progress (
      user_id,
      division,
      topic,
      grade_level,
      session_id,
      type
    )
    select 
      new.user_id,
      new.division,
      new.topic,
      p.grade_level,
      new.session_id,
      'practice'
    from public.profiles p
    where p.id = new.user_id;
  end if;

  -- Update the completed_at timestamp for the session
  update public.user_progress
  set completed_at = now()
  where user_id = new.user_id
    and session_id = new.session_id;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for updating user_progress
create trigger update_user_progress_trigger
  after insert or update on public.practice_attempts
  for each row
  execute function public.update_user_progress();

-- Backfill user_progress with existing practice_attempts
insert into public.user_progress (
  user_id,
  division,
  topic,
  grade_level,
  session_id,
  type,
  completed_at
)
select distinct
  pa.user_id,
  pa.division,
  pa.topic,
  p.grade_level,
  pa.session_id,
  'practice',
  max(pa.created_at) over (partition by pa.session_id) as completed_at
from public.practice_attempts pa
join public.profiles p on p.id = pa.user_id
where not exists (
  select 1 
  from public.user_progress up 
  where up.user_id = pa.user_id 
    and up.session_id = pa.session_id
); 