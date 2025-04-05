-- Create practice_attempts table
create table public.practice_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  user_answer text not null,
  is_correct boolean not null,
  session_id text not null,
  division text not null,
  topic text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.practice_attempts enable row level security;

-- Create policies
create policy "Users can view their own practice attempts"
  on public.practice_attempts for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own practice attempts"
  on public.practice_attempts for insert
  with check ( auth.uid() = user_id );

-- Create indexes for faster queries
create index idx_practice_attempts_user_id on public.practice_attempts(user_id);
create index idx_practice_attempts_session_id on public.practice_attempts(session_id);
create index idx_practice_attempts_question_id on public.practice_attempts(question_id);
create index idx_practice_attempts_created_at on public.practice_attempts(created_at); 