-- Set admin role for platform administrators
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'landon@aimpacttechnology.com'
    -- Add additional admin emails below:
    -- 'james.hilyard@example.com'
  )
);
