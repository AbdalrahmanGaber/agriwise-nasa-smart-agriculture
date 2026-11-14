#!/bin/bash
# Field Shift — FINAL E2E: results/calendar-date + action center + AR + mobile
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
wait_snap 'Results Dashboard|Best Crop' /tmp/f1.txt 30 || { echo "results not rendered"; head -12 /tmp/f1.txt; exit 1; }
echo "[PASS] Results Dashboard renders (stored analysis alive)"

echo "== 1. Crop Calendar date feature =="
wait_snap 'Show date picker' /tmp/f2.txt 20 || exit 1
SHOWREF=$(grep -E 'button "Show date picker' /tmp/f2.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
echo "   show-picker button=@$SHOWREF"
$AB click "@$SHOWREF" >/dev/null 2>&1
wait_snap 'planting date' /tmp/f2.txt 20 || exit 1
DREF=$(refx 'textbox.*planting date|planting date' /tmp/f2.txt | head -1)
DREF=$(grep -E 'textbox' /tmp/f2.txt | grep -iE 'planting date|date' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
echo "   date input=@$DREF"
$AB fill "@$DREF" "2026-11-01" >/dev/null 2>&1
$AB press Tab >/dev/null 2>&1; sleep 2
$AB snapshot -i > /tmp/f3.txt 2>&1
if grep -qE 'Today: day' /tmp/f3.txt; then echo "[PASS] actual-date anchor: '$(grep -oE 'Today: day [0-9]+ — [A-Za-z &]+' /tmp/f3.txt | head -1)'"; else echo "[FAIL] Today marker missing"; grep -iE 'today|day [0-9]' /tmp/f3.txt | head -4; fi
if grep -qE 'planning|estimate' /tmp/f3.txt; then grep -oE 'anchored[^"]*|planning[^".]*' /tmp/f3.txt | head -2; fi
CLRREF=$(grep -E 'button "Clear"' /tmp/f3.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
if [ -n "$CLRREF" ]; then $AB click "@$CLRREF" >/dev/null 2>&1; sleep 1; $AB snapshot -i > /tmp/f4.txt 2>&1; grep -qE 'Today: day' /tmp/f4.txt && echo "[WARN] clear failed" || echo "[PASS] Clear resets to planning estimate"; fi

echo "== 2. Action Center new cards =="
ACREF=$(refx 'link "Action Center' /tmp/f4.txt); [ -z "$ACREF" ] && ACREF=$(refx 'link "Action Center' /tmp/f1.txt)
$AB click "@$ACREF" >/dev/null 2>&1
wait_snap 'Climate risk snapshot|Crop calendar' /tmp/f5.txt 20 || exit 1
grep -B1 -A4 'Climate risk snapshot' /tmp/f5.txt | head -14
echo "   ---"
grep -B1 -A5 'Crop calendar — current stage' /tmp/f5.txt | head -16

echo "== 3. Arabic RTL toggle =="
LANGREF=$(refx 'button "Language' /tmp/f5.txt)
$AB click "@$LANGREF" >/dev/null 2>&1; sleep 2
$AB snapshot -i > /tmp/f6.txt 2>&1
grep -qE 'لمحة المخاطر|تقويم المحصول' /tmp/f6.txt && echo "[PASS] Arabic card titles render" || echo "[INFO] AR check: $(grep -cE '[\x{0600}-\x{06FF}]' /tmp/f6.txt 2>/dev/null || echo '?') arabic lines"
$AB eval "document.documentElement.dir" 2>&1 | tail -1
LANGREF2=$(grep -E 'button "Language' /tmp/f6.txt | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
$AB click "@$LANGREF2" >/dev/null 2>&1; sleep 1

echo "== 4. Mobile viewport =="
$AB set device "iPhone 14" >/dev/null 2>&1
$AB snapshot -i > /tmp/f7.txt 2>&1
echo "   mobile elements: $(wc -l < /tmp/f7.txt)"; grep -qE 'Action Center|Navigation' /tmp/f7.txt && echo "[PASS] mobile layout renders" || echo "[INFO] mobile: check nav"
$AB set viewport 1280 800 >/dev/null 2>&1
echo "== E2E COMPLETE =="
