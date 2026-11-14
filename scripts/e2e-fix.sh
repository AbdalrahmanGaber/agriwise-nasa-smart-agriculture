#!/bin/bash
# Field Shift — date set via React setter + Action Center full inspection
set -u
cd /home/z/my-project
AB="agent-browser"

C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
echo "[srv] $C"
if [ "$C" != "200" ]; then
  pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1
  setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &
  for i in $(seq 1 45); do C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null); [ "$C" = "200" ] && break; sleep 2; done
  echo "[srv] restarted: $C"
fi

$AB open "http://localhost:3000/#/results" >/dev/null 2>&1
for i in $(seq 1 20); do $AB snapshot -i > /tmp/h1.txt 2>&1; grep -q 'Best Crop' /tmp/h1.txt && break; sleep 1.5; done
echo "[results] $(grep -c . /tmp/h1.txt) lines"

echo "== set date via React setter =="
$AB eval "
(() => {
  const i = document.getElementById('cal-plant-date');
  if (!i) return 'NO_INPUT';
  const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  s.call(i, '2026-11-01');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new Event('change', { bubbles: true }));
  return 'SET:' + i.value;
})()" 2>&1 | tail -2
sleep 2
$AB snapshot -i > /tmp/h2.txt 2>&1
echo "-- basis banner + marker --"
grep -oE 'Today: day [0-9]+ — [A-Za-z &,()\-]+' /tmp/h2.txt | head -2
grep -E 'button "Clear"' /tmp/h2.txt | head -1
grep -E 'anchored|actual planting|recommended window|planning' /tmp/h2.txt | head -3
echo "-- input value now --"
$AB eval "document.getElementById('cal-plant-date')?.value" 2>&1 | tail -1

echo "== Action Center full =="
ACREF=$(grep -E 'link "Action Center' /tmp/h2.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@$ACREF" >/dev/null 2>&1
sleep 3
$AB snapshot > /tmp/h3.txt 2>&1
grep -nE 'Climate risk snapshot|Crop calendar|cardRisk|heading|skeleton|Open tool|pulse|animate' /tmp/h3.txt | head -25
echo "-- store state --"
$AB eval "JSON.stringify(Object.keys(sessionStorage).map(k => k + '=' + (sessionStorage.getItem(k)||'').length + 'B'))" 2>&1 | tail -2
