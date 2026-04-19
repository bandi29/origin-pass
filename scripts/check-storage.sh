#!/bin/sh
# Run storage diagnostic. Start dev server first: npm run dev
# Usage: ./scripts/check-storage.sh [base_url]
# Example: ./scripts/check-storage.sh http://localhost:3000

BASE_URL="${1:-http://localhost:3000}"
URL="${BASE_URL}/api/diagnostics/storage"

echo "Checking Supabase storage setup..."
echo "GET $URL"
echo ""

curl -s "$URL" | jq . 2>/dev/null || curl -s "$URL"

echo ""
echo "If ok: true, storage is ready for image uploads."
echo "If ok: false, fix the checks above and run: supabase db push"
