#!/bin/bash
# Field Shift — FULL golden path E2E: analyze → results → calendar date → action center
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

$AB open "http://localhost:3000/#/analyze" >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1; sleep 2

echo "== 1. location =="
$AB snapshot -i > /tmp/ab4-1.txt 2>&1
SREF=$(grep -E 'textbox "Search' /tmp/ab4-1.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB fill "@${SREF}" "Luxor, Egypt" >/dev/null 2>&1; sleep 3
$AB snapshot -i > /tmp/ab4-2.txt 2>&1
LREF=$(grep -E 'button "Luxor, Egypt"' /tmp/ab4-2.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@${LREF}" >/dev/null 2>&1; sleep 2
$AB snapshot -i > /tmp/ab4-3.txt 2>&1
CREF=$(grep -E 'Confirm Location' /tmp/ab4-3.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@${CREF}" 2>&1 | tail -1; sleep 2

echo "== 2. form: clay soil + submit =="
$AB snapshot -i > /tmp/ab4-4.txt 2>&1
SOILREF=$(grep -E 'radio "Clay soil' /tmp/ab4-4.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@${SOILREF}" 2>&1 | tail -1
AREF=$(grep -E 'button "Analyze My Farm"' /tmp/ab4-4.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@${AREF}" 2>&1 | tail -1
echo "   waiting for NASA analysis..."
sleep 18
$AB wait --load networkidle >/dev/null 2>&1
$AB snapshot -i > /tmp/ab4-results.txt 2>&1
echo "== 3. results view =="
grep -iE 'heading|Risk|Plant|Wait|score' /tmp/ab4-results.txt | head -15
