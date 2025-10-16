#!/bin/bash
# Verify RLS is working correctly in local Postgres

echo "=== Testing RLS Enforcement ==="
echo ""

echo "1. Checking notifications as User 1..."
docker-compose exec -T postgres psql -U retroscope_app -d retroscope << 'EOF'
BEGIN;
SELECT set_config('request.jwt.claim.sub', '550e8400-e29b-41d4-a716-446655440000', FALSE);
SELECT set_config('request.jwt.claim.role', 'authenticated', FALSE);
SELECT 'User 1 sees:' as description, COUNT(*) as count FROM notifications;
SELECT id, type, title FROM notifications;
COMMIT;
EOF

echo ""
echo "2. Checking notifications as User 2..."
docker-compose exec -T postgres psql -U retroscope_app -d retroscope << 'EOF'
BEGIN;
SELECT set_config('request.jwt.claim.sub', '650e8400-e29b-41d4-a716-446655440001', FALSE);
SELECT set_config('request.jwt.claim.role', 'authenticated', FALSE);
SELECT 'User 2 sees:' as description, COUNT(*) as count FROM notifications;
SELECT id, type, title FROM notifications;
COMMIT;
EOF

echo ""
echo "3. Checking all notifications as superuser (bypasses RLS)..."
docker-compose exec -T postgres psql -U postgres -d retroscope -c "
SELECT 'Total notifications in DB:' as description, COUNT(*) as count FROM notifications;
SELECT user_id, type, title FROM notifications ORDER BY user_id;
"

echo ""
echo "=== RLS Test Complete ==="

