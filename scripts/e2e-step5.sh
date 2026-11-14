#!/bin/bash
# Field Shift — FULL golden path E2E v2 (robust: snapshot-until-found)
set -u
cd /home/z/my-project
AB="agent-browser"

wait_snap() { # $1=pattern $2=outfile $3=max tries
  local n=${3:-20}
  for i in $(seq 1 "$n"); do
    $AB snapshot -i > "$2" 2>&1
    grep -qE "$1" "$2" && return 0
    sleep 1.5
  done
  echo "   [wait_snap TIMEOUT] $1"; return 1
}
refx() { grep -E "$1" "$2" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

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
wait_snap 'textbox "Search' /tmp/w1.txt 25 || exit 1
SREF=$(refx 'textbox "Search' /tmp/w1.txt); echo "[1] search=@$SREF"
$AB fill "@$SREF" "Luxor, Egypt" >/dev/null 2>&1
wait_snap 'button "Luxor' /tmp/w2.txt 15 || exit 1
LREF=$(refx 'button "Luxor, Egypt"' /tmp/w2.txt); echo "[1] suggest=@$LREF"
$AB click "@$LREF" >/dev/null 2>&1
wait_snap 'Confirm Location' /tmp/w3.txt 15 || exit 1
CREF=$(refx 'Confirm Location' /tmp/w3.txt); echo "[1] confirm=@$CREF"
$AB click "@$CREF" >/dev/null 2>&1

wait_snap 'radio "Clay soil' /tmp/w4.txt 20 || exit 1
SOILREF=$(refx 'radio "Clay soil' /tmp/w4.txt); echo "[2] clay=@$SOILREF"
$AB click "@$SOILREF" >/dev/null 2>&1
wait_snap 'Analyze My Farm' /tmp/w5.txt 10 || exit 1
AREF=$(refx 'button "Analyze My Farm"' /tmp/w5.txt); echo "[2] submit=@$AREF"
$AB click "@$AREF" 2>&1 | tail -1
echo "[3] waiting NASA analysis (~15s)..."
sleep 15
wait_snap 'Best crop|Recommended|risk|Results' /tmp/w6.txt 20
echo "== 3. results =="
grep -iE 'heading "[A-Z]|Best crop|Plant now|Wait' /tmp/w6.txt | head -10

echo "== 4. Smart Tools -> Crop Calendar =="
MREF=$(refx 'button "Smart Tools"' /tmp/w6.txt); echo "[4] menu=@$MREF"
$AB click "@$MREF" >/dev/null 2>&1; sleep 1
$AB snapshot -i > /tmp/w7.txt 2>&1
CALREF=$(refx 'Crop Calendar' /tmp/w7.txt); echo "[4] calendar=@$CALREF"
$AB click "@$CALREF" >/dev/null 2>&1
wait_snap 'growth stage|Cycle|calendar|Calendar' /tmp/w8.txt 20
echo "== 4. calendar view =="
grep -iE 'textbox|date|Planting' /tmp/w8.txt | head -10
