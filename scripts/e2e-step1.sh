#!/bin/bash
# Field Shift — end-to-end browser verification of the published build.
# Server + browser live within THIS call only (sandbox kills processes at call end).
set -u
cd /home/z/my-project
AB="agent-browser"

pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1
setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &

UP=0
for i in $(seq 1 45); do
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$C" = "200" ] && { UP=1; echo "[srv] READY ~$((i*2))s"; break; }; sleep 2
done
[ "$UP" = "1" ] || { echo "FAIL server"; tail -15 /tmp/e2e-dev.log; exit 1; }

$AB open http://localhost:3000 2>&1 | tail -1
$AB wait --load networkidle 2>&1 | tail -1
$AB snapshot -i > /tmp/ab-home.txt 2>&1
echo "== HOME: $(wc -l < /tmp/ab-home.txt) interactive elements =="
grep -iE "button|link" /tmp/ab-home.txt | head -12

echo "== STEP: open analysis wizard =="
$AB find text "Analyze" click 2>&1 | tail -1 || $AB find role button click --name "Start" 2>&1 | tail -1
sleep 2
$AB snapshot -i > /tmp/ab-step2.txt 2>&1
head -25 /tmp/ab-step2.txt
