-- Add level system columns to profiles
alter table public.profiles
add column if not exists level integer default 1,
add column if not exists xp integer default 0,
add column if not exists accuracy integer default 0,
add column if not exists stamina integer default 0;

-- Add level system columns to questions
alter table public.questions
add column if not exists level integer default 1,
add column if not exists xp_reward integer default 10,
add column if not exists accuracy_bonus integer default 0,
add column if not exists stamina_bonus integer default 0;

-- Create function to calculate XP for next level
create or replace function public.calculate_xp_for_next_level(current_level integer)
returns integer as $$
begin
  -- Formula: 100 * 1.5^(level-1)
  return floor(100 * power(1.5, current_level - 1));
end;
$$ language plpgsql immutable;

-- Create function to update user level
create or replace function public.update_user_level()
returns trigger as $$
declare
  xp_needed integer;
begin
  -- Calculate XP needed for next level
  xp_needed := public.calculate_xp_for_next_level(new.level);
  
  -- Check if user has enough XP to level up
  while new.xp >= xp_needed loop
    -- Level up
    new.level := new.level + 1;
    new.xp := new.xp - xp_needed;
    -- Calculate XP needed for next level
    xp_needed := public.calculate_xp_for_next_level(new.level);
  end loop;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for automatic level ups
create trigger update_user_level_trigger
  before update of xp on public.profiles
  for each row
  execute function public.update_user_level(); 