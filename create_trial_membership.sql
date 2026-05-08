-- Create a 1-minute trial membership for testing
-- This will create a membership that expires in 1 minute

INSERT INTO memberships (user_id, plan_name, duration_days, start_date, end_date, status)
SELECT 
    u.id as user_id,
    '1-Minute Trial' as plan_name,
    0 as duration_days,  -- 0 days for 1-minute trial
    NOW() as start_date,
    DATE_ADD(NOW(), INTERVAL 1 MINUTE) as end_date,
    'Active' as status
FROM users u
WHERE u.username = 'admin'  -- Replace with actual username to test
LIMIT 1;

-- Verify the trial membership was created
SELECT * FROM memberships WHERE plan_name = '1-Minute Trial' ORDER BY created_at DESC LIMIT 1;
