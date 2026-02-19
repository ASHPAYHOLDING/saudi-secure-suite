#!/bin/bash
# ============================================================
#  Numaxio Load Test — Seed Auth Users
# ============================================================
#  Creates 200 users (50 tenants × 4 users) via Supabase Auth API
#  
#  Usage:
#    export SUPABASE_URL="https://izuyfgzwzszanjpenbmx.supabase.co"
#    export SERVICE_ROLE_KEY="your-service-role-key"
#    bash tests/load/seed-users.sh
#
#  Prerequisites: 
#    - Run seed-data.sql first to create tenants
#    - jq installed (brew install jq / apt install jq)
# ============================================================

set -euo pipefail

BASE_URL="${SUPABASE_URL:?Set SUPABASE_URL}"
KEY="${SERVICE_ROLE_KEY:?Set SERVICE_ROLE_KEY}"
PASSWORD="LoadTest2026!Secure"

echo "🔧 Fetching tenant IDs..."
TENANTS=$(curl -s "${BASE_URL}/rest/v1/tenants?name_en=like.LoadTest*&select=id,name_en&order=name_en&limit=50" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}")

TENANT_COUNT=$(echo "$TENANTS" | jq length)
echo "📦 Found ${TENANT_COUNT} load-test tenants"

for t in $(seq 1 $TENANT_COUNT); do
  IDX=$((t - 1))
  TENANT_ID=$(echo "$TENANTS" | jq -r ".[$IDX].id")
  TENANT_NAME=$(echo "$TENANTS" | jq -r ".[$IDX].name_en")

  for u in $(seq 1 4); do
    EMAIL="loadtest-t${t}-u${u}@numaxio.test"
    ROLE="owner"
    [ "$u" -gt 1 ] && ROLE="member"

    # Create auth user
    USER_RESP=$(curl -s "${BASE_URL}/auth/v1/admin/users" \
      -H "apikey: ${KEY}" \
      -H "Authorization: Bearer ${KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"${EMAIL}\",
        \"password\": \"${PASSWORD}\",
        \"email_confirm\": true,
        \"user_metadata\": {\"full_name\": \"Load Test T${t} U${u}\"}
      }" 2>/dev/null)

    USER_ID=$(echo "$USER_RESP" | jq -r '.id // empty')
    if [ -z "$USER_ID" ]; then
      # User might already exist, try to get ID
      USER_ID=$(echo "$USER_RESP" | jq -r '.msg // empty')
      echo "  ⚠️  ${EMAIL} — already exists or error"
      continue
    fi

    # Link to tenant
    curl -s "${BASE_URL}/rest/v1/tenant_members" \
      -H "apikey: ${KEY}" \
      -H "Authorization: Bearer ${KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{
        \"tenant_id\": \"${TENANT_ID}\",
        \"user_id\": \"${USER_ID}\",
        \"role\": \"${ROLE}\"
      }" > /dev/null 2>&1

    echo "  ✅ ${EMAIL} → ${TENANT_NAME} (${ROLE})"
  done
done

echo ""
echo "🎉 Seeding complete! Ready for: k6 run tests/load/load-test.js"
