#!/bin/bash
# Field Shift — deployment verification (single-call server lifecycle)
set -u
cd /home/z/my-project

# 0. clean port
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1

# 1. start dev server (same command the platform boot flow ends with)
setsid nohup bun run dev > /tmp/verify-dev.log 2>&1 < /dev/null &

# 2. wait for readiness (up to 90s)
UP=0
for i in $(seq 1 45); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then UP=1; echo "READY after ~$((i*2))s"; break; fi
  sleep 2
done
[ "$UP" = "1" ] || { echo "SERVER FAILED TO START"; tail -20 /tmp/verify-dev.log; exit 1; }

# 3. route checks
echo "--- GET / ---"
curl -s -o /tmp/page.html -w "status=%{http_code} bytes=%{size_download} time=%{time_total}s\n" --max-time 30 http://localhost:3000/
grep -oE "<title>[^<]*</title>" /tmp/page.html | head -1

echo "--- GET /api/analyses (saved data intact?) ---"
curl -s --max-time 15 http://localhost:3000/api/analyses | head -c 400; echo ""

echo "--- API routes mounted (405=mounted wrong-method, 200=ok) ---"
for r in analyze planting irrigation yield geocode forecast analyses; do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X GET http://localhost:3000/api/$r 2>/dev/null)
  echo "/api/$r GET -> $C"
done

echo "--- server log tail ---"
tail -6 /tmp/verify-dev.log
