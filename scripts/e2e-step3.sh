#!/bin/bash
# Field Shift — E2E part 3: confirm → farm form → analyze → results → calendar date → action center
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

echo "== 1. location search + confirm =="
$AB snapshot -i > /tmp/ab3-loc.txt 2>&1
REF=$($AB snapshot -i --json 2>/dev/null | grep -oE '"ref":"@[a-z0-9]+","name":"Search[^"]*"' | grep -oE '@[a-z0-9]+' | head -1)
echo "search ref: $REF"
$AB fill "$REF" "Luxor, Egypt" >/dev/null 2>&1; sleep 3
$AB find text "Luxor, Egypt" click >/dev/null 2>&1; sleep 2
$AB find text "Yes, Confirm Location" click 2>&1 | tail -1; sleep 2

echo "== 2. farm form =="
$AB snapshot -i > /tmp/ab3-form.txt 2>&1
grep -iE "combobox|textbox|button|spinbutton|radio" /tmp/ab3-form.txt | head -25
