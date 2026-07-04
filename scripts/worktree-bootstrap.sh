#!/usr/bin/env bash
#
# worktree-bootstrap.sh — SYN-1070
#
# Make a freshly-created git worktree runnable locally, idempotently.
# A new worktree has no node_modules/ and no .env.local, so the dev server and
# the startup env-validator can't run. This scripts the verified recipe:
#
#     ln -s <MAIN_REPO>/.env.local .env.local
#     npm install
#     npx prisma generate
#
# GUARDRAILS (do not violate):
#   * Package manager is npm — NEVER pnpm (repo uses package-lock.json).
#   * Dev server port is 3008 (`npm run dev`).
#   * .env.local must stay a SYMLINK into the main repo — never copied, never
#     committed (.gitignore already ignores it). Do not `git add` it.
#
# Idempotent: safe to re-run. Skips the symlink if .env.local already exists and
# skips npm install if node_modules is already populated. Exits non-zero only on
# a genuine failure. Portable to macOS bash 3.2 (no bash-4 features).

set -euo pipefail

# Run from the worktree root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKTREE_ROOT"

echo "==> SYN-1070 worktree bootstrap"
echo "    worktree: $WORKTREE_ROOT"

# --- 1. Resolve the MAIN repo path dynamically -----------------------------
# `git worktree list --porcelain` emits the main working tree first. Never
# hardcode an absolute path — it must work for any checkout on any machine.
MAIN_REPO="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
if [ -z "${MAIN_REPO:-}" ]; then
  echo "ERROR: could not resolve the main repo path via 'git worktree list'." >&2
  exit 1
fi
echo "    main repo: $MAIN_REPO"

# --- 2. Symlink .env.local (never copy) ------------------------------------
if [ -e .env.local ] || [ -L .env.local ]; then
  echo "==> .env.local already present — skipping symlink."
elif [ -e "$MAIN_REPO/.env.local" ]; then
  ln -s "$MAIN_REPO/.env.local" .env.local
  echo "==> Symlinked .env.local -> $MAIN_REPO/.env.local"
else
  echo "==> WARNING: main repo has no .env.local ($MAIN_REPO/.env.local)."
  echo "    The env-validator will report missing vars until it exists. Continuing."
fi

# --- 3. npm install (idempotent) -------------------------------------------
# npm writes node_modules/.package-lock.json after a successful install; use it
# as the sentinel so a re-run is fast and doesn't reinstall needlessly.
if [ -f node_modules/.package-lock.json ]; then
  echo "==> node_modules already populated — skipping npm install."
else
  echo "==> Running npm install (this can take a few minutes)..."
  npm install
  echo "==> npm install complete."
fi

# --- 4. prisma generate ----------------------------------------------------
# (postinstall also runs this, but run it explicitly so the step is guaranteed
# even when npm install was skipped.)
echo "==> Running npx prisma generate..."
npx prisma generate
echo "==> prisma generate complete."

# --- 5. Success summary ----------------------------------------------------
if [ -L .env.local ]; then
  ENV_STATE="symlink -> $(readlink .env.local)"
else
  ENV_STATE="present"
fi
cat <<EOF

==> Bootstrap complete
    .env.local  : $ENV_STATE
    node_modules: populated
    prisma client: generated

    Next:  npm run dev   # serves http://localhost:3008
EOF
