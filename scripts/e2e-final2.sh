#!/bin/bash
# Field Shift — FINAL E2E v2: calendar grid selection + action center + AR + mobile
set -u
cd /home/z/my-project
AB="agent-browser"
wait_snap() { local n=${3:-20}; for i in $(seq 1 "$n"); do $AB snapshot -i > "$2" 2>&1; grep -qE "$1" "$2" && return 0; sleep 1.5; done; echo "   [TIMEOUT] $1"; return 1; }
refx() { grep -E "$1" "$2" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "bun run dev" 2>/dev/null; sleep 2
setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &
UP=0; for i in $(seq 1 45); do C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null); [ "$C" = "200" ] && { UP=1; break; }; sleep 2; done
[ "$UP" = "1" ] || { echo "FAIL server"; exit 1; }
echo "[srv] ready"

$AB open "http://localhost:3000/#/results" >/dev/null 2>&1
wait_snap 'Best Crop|Results Dashboard' /tmp/g1.txt 30 || exit 1
echo "[PASS] Results Dashboard renders"

echo "== 1. calendar date =="
wait_snap 'Show date picker' /tmp/g2.txt 20 || exit 1
SHOWREF=$(refx 'button "Show date picker' /tmp/g2.txt)
$AB click "@$SHOWREF" >/dev/null 2>&1
wait_snap 'gridcell ".*November 1, 2026' /tmp/g3.txt 20 || exit 1
GREF=$(refx 'gridcell "Sunday, November 1, 2026' /tmp/g3.txt)
echo "   Nov-1 cell=@$GREF — clicking"
$AB click "@$GREF" >/dev/null 2>&1; sleep 2
$AB snapshot -i > /tmp/g4.txt 2>&1
if grep -qE 'Today: day' /tmp/g4.txt; then
  echo "[PASS] date anchor: $(grep -oE 'Today: day [0-9]+ — [A-Za-z &,()\-]+' /tmp/g4.txt | head -1)"
else
  echo "[FAIL] no Today marker"; grep -iE 'today|anchor|planning estimate|basis' /tmp/g4.txt | head -5
fi
CLRREF=$(refx 'button "Clear"' /tmp/g4.txt)
if [ -n "$CLRREF" ]; then
  $AB click "@$CLRREF" >/dev/null 2>&1; sleep 1.5
  $AB snapshot -i > /tmp/g5.txt 2>&1
  grep -qE 'Today: day' /tmp/g5.txt && echo "[WARN] Clear ineffective" || echo "[PASS] Clear -> planning estimate restored"
fi

echo "== 2. Action Center cards =="
ACREF=$(refx 'link "Action Center' /tmp/g5.txt); [ -z "$ACREF" ] && ACREF=$(refx 'link "Action Center' /tmp/g1.txt)
$AB click "@$ACREF" >/dev/null 2>&1
wait_snap 'Climate risk snapshot|Crop calendar' /tmp/g6.txt 25 || exit 1
echo "--- risk card ---"; grep -A6 'Climate risk snapshot' /tmp/g6.txt | head -10
echo "--- calendar card ---"; grep -A8 'Crop calendar — current stage' /tmp/g6.txt | head -12

echo "== 3. Arabic =="
LREF=$(refx 'button "Language' /tmp/g6.txt)
$AB click "@$LREF" >/dev/null 2>&1; sleep 2
$AB snapshot -i > /tmp/g7.txt 2>&1
grep -qE 'لمحة المخاطر|تقويم المحصول' /tmp/g7.txt && echo "[PASS] Arabic cards render" || echo "[INFO] AR titles not in snapshot"
echo "dir=$($AB eval 'document.documentElement.dir' 2>&1 | tail -1)"
L2=$(refx 'button "Language' /tmp/g7.txt); $AB click "@$L2" >/dev/null 2>&1; sleep 1

echo "== 4. mobile =="
$AB set device "iPhone 14" >/dev/null 2>&1; sleep 1
$AB snapshot -i > /tmp/g8.txt 2>&1
echo "   mobile snapshot lines: $(wc -l < /tmp/g8.txt)"
$AB set viewport 1280 800 >/dev/null 2>&1
echo "== E2E DONE =="
