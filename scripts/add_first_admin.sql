-- Script to add the first admin user
-- Replace 'user_email@example.com' with the actual email of the user you want to make admin

-- Option 1: Update by email (if you know the email)
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'user_email@example.com'
);

-- Option 2: Update by user ID (if you know the user ID)
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = 'user-uuid-here';

-- Option 3: Update the most recent user (be careful with this one)
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = (
--   SELECT id FROM auth.users 
--   ORDER BY created_at DESC 
--   LIMIT 1
-- );

-- Verify the change
SELECT 
  p.id,
  p.username,
  p.role,
  u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin'; 