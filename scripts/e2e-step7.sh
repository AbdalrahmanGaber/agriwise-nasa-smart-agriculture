#!/bin/bash
# Field Shift — FULL golden path E2E v4 (adaptive) + new features, on a clean server
set -u
cd /home/z/my-project
AB="agent-browser"

wait_snap() { local n=${3:-20}; for i in $(seq 1 "$n"); do $AB snapshot -i > "$2" 2>&1; grep -qE "$1" "$2" && return 0; sleep 1.5; done; echo "   [TIMEOUT] $1"; return 1; }
refx() { grep -E "$1" "$2" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "bun run dev" 2>/dev/null; sleep 2
rm -rf /home/z/my-project/.next/dev 2>/dev/null
setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &
UP=0; for i in $(seq 1 45); do C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null); [ "$C" = "200" ] && { UP=1; break; }; sleep 2; done
[ "$UP" = "1" ] || { echo "FAIL server"; tail -8 /tmp/e2e-dev.log; exit 1; }
echo "[srv] ready"

$AB open "http://localhost:3000/#/analyze" >/dev/null 2>&1
wait_snap 'radio "Clay soil|textbox "Search' /tmp/z1.txt 30 || exit 1

if grep -q 'textbox "Search' /tmp/z1.txt; then
  echo "[1] location step"
  SREF=$(refx 'textbox "Search' /tmp/z1.txt); $AB fill "@$SREF" "Luxor, Egypt" >/dev/null 2>&1
  wait_snap 'button "Luxor' /tmp/z2.txt 15 || exit 1
  LREF=$(refx 'button "Luxor, Egypt"' /tmp/z2.txt); $AB click "@$LREF" >/dev/null 2>&1
  wait_snap 'Confirm Location' /tmp/z3.txt 15 || exit 1
  CREF=$(refx 'Confirm Location' /tmp/z3.txt); $AB click "@$CREF" >/dev/null 2>&1
  wait_snap 'radio "Clay soil' /tmp/z4.txt 20 || exit 1
else
  echo "[1] location stored — form direct"
fi

wait_snap 'Analyze My Farm' /tmp/z5.txt 15 || exit 1
AREF=$(refx 'button "Analyze My Farm"' /tmp/z5.txt); echo "[2] submit=@$AREF"
$AB click "@$AREF" >/dev/null 2>&1
echo "[3] NASA analysis..."
sleep 14
wait_snap 'Plant now|Wait|best crop|Best crop|months|suitab' /tmp/z6.txt 25
echo "== RESULTS =="
grep -iE 'heading "[A-Z]|Plant now|Wait|Best crop|score' /tmp/z6.txt | head -10

echo "== 4. Smart Tools menu =="
MREF=$(refx 'button "Smart Tools"' /tmp/z6.txt)
$AB click "@$MREF" >/dev/null 2>&1; sleep 1.5
$AB snapshot -i > /tmp/z7.txt 2>&1
grep -iE 'menu|link|option' /tmp/z7.txt | head -14
CALREF=$(refx 'Crop Calendar' /tmp/z7.txt)
echo "[4] calendar=@$CALREF"
if [ -n "$CALREF" ]; then $AB click "@$CALREF" >/dev/null 2>&1; fi
wait_snap 'Growth|stage|Calendar|germination' /tmp/z8.txt 20
echo "== 5. CALENDAR VIEW =="
grep -iE 'textbox|date|button "[A-Z]' /tmp/z8.txt | head -14
