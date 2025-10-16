-- Test RLS functionality in local Postgres
-- This script demonstrates how RLS policies work with session variables

-- Set user context (simulating a JWT token)
SELECT set_config('request.jwt.claim.sub', '550e8400-e29b-41d4-a716-446655440000', FALSE);
SELECT set_config('request.jwt.claim.role', 'authenticated', FALSE);

-- Verify the context is set
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role;

-- Insert a test profile for our user
INSERT INTO auth.users (id, email) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, full_name, email, role) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Test User', 'test@example.com', 'user')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Insert a test notification
INSERT INTO notifications (id, user_id, type, title, message) VALUES 
    (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'test', 'Test Notification', 'This is a test');

-- Query notifications - should only return this user's notifications due to RLS
SELECT id, user_id, type, title, is_read, created_at 
FROM notifications
ORDER BY created_at DESC
LIMIT 5;

-- Try to query as a different user - should return no results
SELECT set_config('request.jwt.claim.sub', '650e8400-e29b-41d4-a716-446655440001', FALSE);

SELECT COUNT(*) as notification_count_for_different_user 
FROM notifications;

-- Switch back to original user - should see the notification again
SELECT set_config('request.jwt.claim.sub', '550e8400-e29b-41d4-a716-446655440000', FALSE);

SELECT COUNT(*) as notification_count_for_original_user 
FROM notifications;

-- Show all RLS policies on notifications table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

