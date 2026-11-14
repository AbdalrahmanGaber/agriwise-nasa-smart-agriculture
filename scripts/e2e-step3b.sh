#!/bin/bash
# Field Shift — E2E part 3b: location (robust refs) → confirm
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

$AB snapshot -i > /tmp/ab3-loc.txt 2>&1
SREF=$(grep -E 'textbox "Search' /tmp/ab3-loc.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
echo "search ref: @${SREF}"
$AB fill "@${SREF}" "Luxor, Egypt" 2>&1 | tail -1
sleep 3
$AB snapshot -i > /tmp/ab3-sug.txt 2>&1
LREF=$(grep -E 'button "Luxor, Egypt"' /tmp/ab3-sug.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
echo "suggestion ref: @${LREF}"
$AB click "@${LREF}" 2>&1 | tail -1
sleep 2
$AB snapshot -i > /tmp/ab3-conf.txt 2>&1
CREF=$(grep -E 'Confirm Location' /tmp/ab3-conf.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
echo "confirm ref: @${CREF}"
$AB click "@${CREF}" 2>&1 | tail -1
sleep 2

echo "== farm form =="
$AB snapshot -i > /tmp/ab3-form.txt 2>&1
grep -iE 'combobox|textbox|spinbutton|button "[A-Z]' /tmp/ab3-form.txt | head -30
