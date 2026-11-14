#!/bin/bash
# Field Shift — full golden path E2E in ONE call (server + browser die at call end)
set -u
cd /home/z/my-project
AB="agent-browser"

pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1
setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &
UP=0
for i in $(seq 1 45); do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$C" = "200" ] && { UP=1; break; }; sleep 2
done
[ "$UP" = "1" ] || { echo "FAIL server"; exit 1; }
echo "[srv] ready"

$AB open http://localhost:3000 >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1

echo "== 1. wizard: location =="
$AB find text "Analyze Your Farm" click >/dev/null 2>&1; sleep 1
$AB fill @e69 "Luxor, Egypt" >/dev/null 2>&1 || $AB find label "Search village, city or address" fill "Luxor, Egypt" >/dev/null 2>&1
sleep 3
$AB snapshot -i > /tmp/ab-loc.txt 2>&1
grep -iE "option|luxor|listbox|suggestion|button" /tmp/ab-loc.txt | head -8

echo "== 2. pick suggestion =="
$AB find text "Luxor" click 2>&1 | tail -1
sleep 2
$AB snapshot -i > /tmp/ab-confirm.txt 2>&1
head -30 /tmp/ab-confirm.txt | tail -18
