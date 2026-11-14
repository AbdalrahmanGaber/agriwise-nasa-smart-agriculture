#!/bin/bash
# Field Shift — FULL golden path E2E v3 (adaptive: location may be pre-filled)
set -u
cd /home/z/my-project
AB="agent-browser"

wait_snap() { local n=${3:-20}; for i in $(seq 1 "$n"); do $AB snapshot -i > "$2" 2>&1; grep -qE "$1" "$2" && return 0; sleep 1.5; done; echo "   [TIMEOUT] $1"; return 1; }
refx() { grep -E "$1" "$2" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1
setsid nohup bun run dev > /tmp/e2e-dev.log 2>&1 < /dev/null &
UP=0; for i in $(seq 1 45); do C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null); [ "$C" = "200" ] && { UP=1; break; }; sleep 2; done
[ "$UP" = "1" ] || { echo "FAIL server"; exit 1; }
echo "[srv] ready"

$AB open "http://localhost:3000/#/analyze" >/dev/null 2>&1
wait_snap 'radio "Clay soil|textbox "Search' /tmp/v1.txt 25 || exit 1

if grep -q 'textbox "Search' /tmp/v1.txt; then
  echo "[1] location step"
  SREF=$(refx 'textbox "Search' /tmp/v1.txt)
  $AB fill "@$SREF" "Luxor, Egypt" >/dev/null 2>&1
  wait_snap 'button "Luxor' /tmp/v2.txt 15 || exit 1
  LREF=$(refx 'button "Luxor, Egypt"' /tmp/v2.txt); $AB click "@$LREF" >/dev/null 2>&1
  wait_snap 'Confirm Location' /tmp/v3.txt 15 || exit 1
  CREF=$(refx 'Confirm Location' /tmp/v3.txt); $AB click "@$CREF" >/dev/null 2>&1
  wait_snap 'radio "Clay soil' /tmp/v4.txt 20 || exit 1
else
  echo "[1] location already stored — straight to form"
fi

wait_snap 'Analyze My Farm' /tmp/v5.txt 15 || exit 1
SOILREF=$(refx 'radio "Clay soil' /tmp/v5.txt)
[ -n "$SOILREF" ] && $AB click "@$SOILREF" >/dev/null 2>&1
AREF=$(refx 'button "Analyze My Farm"' /tmp/v5.txt); echo "[2] submit=@$AREF"
$AB click "@$AREF" 2>&1 | tail -1
echo "[3] NASA analysis running..."
sleep 15
wait_snap 'Best crop|Recommended crop|Your Farm|results' /tmp/v6.txt 25
echo "== RESULTS VIEW =="
grep -iE 'heading "[A-Z]|Best crop|Plant now|Wait|score|Risk' /tmp/v6.txt | head -12

echo "== 4. Smart Tools -> Crop Calendar =="
MREF=$(refx 'button "Smart Tools"' /tmp/v6.txt)
$AB click "@$MREF" >/dev/null 2>&1; sleep 1
$AB snapshot -i > /tmp/v7.txt 2>&1
CALREF=$(refx 'Crop Calendar' /tmp/v7.txt); echo "[4] calendar link=@$CALREF"
$AB click "@$CALREF" >/dev/null 2>&1
wait_snap 'Growth|stage|Calendar' /tmp/v8.txt 20 || exit 1
echo "== CALENDAR VIEW (elements) =="
grep -iE 'textbox|button "[A-Z]|date' /tmp/v8.txt | head -12
