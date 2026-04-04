#!/usr/bin/env bash
# refresh-routes.sh — Regenerate Zone 1 of .planning/ROUTE_REFERENCE.md
# Zone 1 = header + API routes (everything before the sentinel).
# Zone 2 = Dashboard Pages + Prisma Index + Known Issues + Recent Changes (preserved unchanged).
# Exits 1 with a clear error if the sentinel comment is absent.
set -euo pipefail

FILE=".planning/ROUTE_REFERENCE.md"
SENTINEL="<!-- HAND-MAINTAINED: Do not regenerate below this line -->"
TODAY=$(date +%Y-%m-%d)
TMPWORK=$(mktemp -d)
trap 'rm -rf "$TMPWORK"' EXIT

# 1. Normalise line endings (Windows CRLF safe)
sed -i 's/\r//' "$FILE"

# 2. Sentinel check
if ! grep -qF "$SENTINEL" "$FILE"; then
  echo "ERROR: Sentinel comment not found in ROUTE_REFERENCE.md. Aborting to prevent data loss." >&2
  exit 1
fi

# 3. Extract Zone 2 (sentinel line + everything below) into temp file
SENTINEL_LINE=$(grep -nF "$SENTINEL" "$FILE" | cut -d: -f1)
tail -n +"$SENTINEL_LINE" "$FILE" > "$TMPWORK/zone2.txt"

# 4. Snapshot old route paths for diff
grep -E '^\- `(GET|POST|PUT|PATCH|DELETE)' "$FILE" \
  | grep -oP '/api/[^`]+' > "$TMPWORK/old_routes.txt" 2>/dev/null || true

# 5. Scan all route.ts files — build TSV: group|methods|url_path|auth|models
> "$TMPWORK/routes.tsv"
while IFS= read -r route_file; do
  # Derive URL path from file path
  url_path=$(echo "$route_file" | sed 's|^app||; s|/route\.ts$||')
  [ -z "$url_path" ] && url_path="/"

  # Extract HTTP methods exported from this file (handles both async function and const patterns)
  methods=$(
    { grep -oP '^export async function \K(GET|POST|PUT|PATCH|DELETE)' "$route_file" 2>/dev/null || true; \
      grep -oP '^export const \K(GET|POST|PUT|PATCH|DELETE)' "$route_file" 2>/dev/null || true; } \
    | sort -u | paste -sd, || true
  )
  [ -z "$methods" ] && continue

  # Determine auth level (admin > cron > user > public)
  auth="public"
  if grep -qE "verifyAdmin|isOwnerEmail" "$route_file" 2>/dev/null; then
    auth="admin"
  elif grep -qE "CRON_SECRET" "$route_file" 2>/dev/null; then
    auth="cron"
  elif grep -qE "getUserIdFromRequestOrCookies|getUserIdFromCookies|requireAuth|APISecurityChecker|withAuth" \
      "$route_file" 2>/dev/null; then
    auth="user"
  fi

  # Extract Prisma models used
  models=$(grep -oP 'prisma\.\K[a-zA-Z]+' "$route_file" 2>/dev/null \
    | sort -u | paste -sd, || true)

  # Group key: first path segment after /api/
  group=$(echo "$url_path" | cut -d'/' -f3)
  [ -z "$group" ] && group="root"

  printf '%s|%s|%s|%s|%s\n' "$group" "$methods" "$url_path" "$auth" "$models" \
    >> "$TMPWORK/routes.tsv"
done < <(find app/api -name "route.ts" | sort)

# 6. Compute stats
total=$(wc -l < "$TMPWORK/routes.tsv" | tr -d ' ')
user_count=$(awk  -F'|' '$4=="user"'   "$TMPWORK/routes.tsv" | wc -l | tr -d ' ')
admin_count=$(awk -F'|' '$4=="admin"'  "$TMPWORK/routes.tsv" | wc -l | tr -d ' ')
cron_count=$(awk  -F'|' '$4=="cron"'   "$TMPWORK/routes.tsv" | wc -l | tr -d ' ')
public_count=$(awk -F'|' '$4=="public"' "$TMPWORK/routes.tsv" | wc -l | tr -d ' ')
model_count=$(awk -F'|' 'NF>=5 && $5!=""  {print $5}' "$TMPWORK/routes.tsv" \
  | tr ',' '\n' | grep -v '^$' | sort -u | wc -l | tr -d ' ')

# Extract existing dashboard page count from Zone 2 (hand-maintained, cannot be recomputed)
page_count=$(grep -oP '\*\*\K\d+(?= dashboard pages)' "$FILE" | head -1 || echo "0")
[ "$page_count" = "0" ] && page_count="100"

# 7. Build Zone 1 into a temp file (header + API routes only)
{
  cat <<HEADER
# Synthex Route Reference

> Auto-generated $TODAY. Read before implementing. Update the "Known issues" and "Last audited" fields after each task.
>
> **$total API routes · $page_count dashboard pages · $model_count Prisma models in use**
> Auth: $user_count user-authed · $admin_count admin-only · $cron_count cron · $public_count public

---

## Auth Levels

| Level    | Meaning                                                             |
| -------- | ------------------------------------------------------------------- |
| \`user\`   | Requires valid session (\`getUserIdFromRequestOrCookies\`)            |
| \`admin\`  | Owner email or admin role required (\`verifyAdmin\` / \`isOwnerEmail\`) |
| \`cron\`   | \`CRON_SECRET\` header required                                       |
| \`public\` | No auth — accessible without session                                |

---

## API Routes

Routes grouped by prefix. Format: \`METHOD /api/path — auth — _models_\`
HEADER

  # Emit route groups sorted alphabetically
  current_group=""
  while IFS='|' read -r group methods url_path auth models; do
    if [ "$group" != "$current_group" ]; then
      printf -- '\n### %s\n\n' "$group"
      current_group="$group"
    fi
    if [ -n "$models" ]; then
      printf -- '- `%s %s` — %s — _%s_\n' "$methods" "$url_path" "$auth" "$models"
    else
      printf -- '- `%s %s` — %s\n' "$methods" "$url_path" "$auth"
    fi
  done < <(sort "$TMPWORK/routes.tsv")

  # Trailing separator before Zone 2
  printf -- '\n---\n\n'
} > "$TMPWORK/zone1.txt"

# 8. Write file: new Zone 1 + preserved Zone 2
cat "$TMPWORK/zone1.txt" "$TMPWORK/zone2.txt" > "$FILE"

# 9. Diff summary
grep -E '^\- `(GET|POST|PUT|PATCH|DELETE)' "$FILE" \
  | grep -oP '/api/[^`]+' > "$TMPWORK/new_routes.txt" 2>/dev/null || true
added=$(comm -13 <(sort "$TMPWORK/old_routes.txt") <(sort "$TMPWORK/new_routes.txt") \
  | wc -l | tr -d ' ')
removed=$(comm -23 <(sort "$TMPWORK/old_routes.txt") <(sort "$TMPWORK/new_routes.txt") \
  | wc -l | tr -d ' ')
echo "✓ ROUTE_REFERENCE.md refreshed: +${added} routes added, -${removed} routes removed (${total} total)"
