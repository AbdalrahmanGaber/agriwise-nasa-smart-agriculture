#!/bin/bash
# Build the GitHub-ready deliverable for Field Shift.
# Excludes: .env, local databases, node_modules, build output, git history,
# logs, temp files. Keeps everything the project needs to run.
set -euo pipefail

SRC="/home/z/my-project/fieldshift"
OUT_DIR="/home/z/my-project/download/FieldShift-GitHub-Ready"
ZIP="/home/z/my-project/download/FieldShift-GitHub.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# copy everything except excluded patterns
cd "$SRC"
tar -cf - \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.env' \
  --exclude='./db/custom.db' \
  --exclude='./db/*.db-journal' \
  --exclude='./dev.log' \
  --exclude='./server.log' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./next-env.d.ts' \
  --exclude='./.git' \
  --exclude='./.zscripts' \
  --exclude='./tool-results' \
  . | tar -xf - -C "$OUT_DIR"

# sanity: no secrets, no db, no git
if [ -e "$OUT_DIR/.env" ] || [ -e "$OUT_DIR/db/custom.db" ] || [ -e "$OUT_DIR/.git" ]; then
  echo "FAIL: excluded file leaked into deliverable"; exit 1
fi

# sanity: .env.example present and has no real values
echo "--- .env.example contents ---"
cat "$OUT_DIR/.env.example"

rm -f "$ZIP"
cd "$OUT_DIR"
zip -qr "$ZIP" .
echo "--- deliverable ---"
ls -la /home/z/my-project/download/FieldShift-GitHub.zip
echo "--- top-level files in deliverable ---"
ls -a "$OUT_DIR" | sort
