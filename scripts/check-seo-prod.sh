#!/usr/bin/env bash
# Production SEO smoke check. Needs network; NOT a CI/test gate.
# Usage: scripts/check-seo-prod.sh [base-url]   (default https://www.restocare.in)
set -u

BASE="${1:-https://www.restocare.in}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PAGES=(/ /category/chef /category/helpers-and-waiters /category/deep-cleaning /category/electrician /guides/restaurant-staffing-prices)
CATEGORY_PAGES=(/category/chef /category/helpers-and-waiters /category/deep-cleaning /category/electrician)
FAQ_PAGES=(/category/chef /category/helpers-and-waiters /category/deep-cleaning)
COMING_SOON=(plumber technician ac-appliance-repair pest-control)
EXPECTED_SITEMAP=(/ /about /contact /category/chef /category/helpers-and-waiters /category/deep-cleaning /category/electrician /guides/restaurant-staffing-prices)

FAILS=0
PASSES=0
pass() { echo "PASS  $1"; PASSES=$((PASSES + 1)); }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }
check() { if [ "$1" = 1 ]; then pass "$2"; else fail "$2"; fi; }

fname() { echo "$TMP/$(printf '%s' "$1" | tr '/' '_').html"; }

# fetch <path> -> sets STATUS (000 when unreachable), body in file
fetch() {
  local out
  out="$(curl -sS -m 30 -o "$(fname "$1")" -w '%{http_code}' "$BASE$1" 2>/dev/null)" || out="000"
  [ -f "$(fname "$1")" ] || : > "$(fname "$1")"
  STATUS="$out"
}

count() { grep -o -- "$1" "$2" | wc -l | tr -d ' '; }

canonical() {
  tr '\n' ' ' < "$1" | grep -o '<link[^>]*rel="canonical"[^>]*>' | head -n1 \
    | sed -n 's/.*href="\([^"]*\)".*/\1/p'
}
robots() {
  tr '\n' ' ' < "$1" | grep -o '<meta[^>]*name="robots"[^>]*>' | head -n1 \
    | sed -n 's/.*content="\([^"]*\)".*/\1/p'
}

echo "Base URL: $BASE"
echo
printf '%-40s %-6s %-4s %-7s %-4s %-8s %s | %s\n' PAGE HTTP H1 LDJSON FAQ BAILOUT CANONICAL ROBOTS
for p in "${PAGES[@]}"; do
  fetch "$p"
  f="$(fname "$p")"
  eval "S_$(printf '%s' "$p" | tr -c 'a-zA-Z0-9\n' '_')=$STATUS"
  printf '%-40s %-6s %-4s %-7s %-4s %-8s %s | %s\n' "$p" "$STATUS" \
    "$(count '<h1' "$f")" "$(count 'application/ld+json' "$f")" "$(count 'FAQPage' "$f")" \
    "$(count 'BAILOUT_TO_CLIENT_SIDE_RENDERING' "$f")" "$(canonical "$f")" "$(robots "$f")"
done
echo

key() { printf 'S_%s' "$(printf '%s' "$1" | tr -c 'a-zA-Z0-9\n' '_')"; }

# absence <path> <grep-pattern> <label>: PASS only when the page returned 200 and has no match.
# A page that failed to load has an empty body, so it must FAIL rather than pass vacuously.
absence() {
  local k s n
  k="$(key "$1")"; s="${!k}"
  if [ "$s" != 200 ]; then
    fail "$1 $3 (skipped: $1 returned $s)"
    return
  fi
  n="$(count "$2" "$(fname "$1")")"
  check "$([ "$n" = 0 ] && echo 1 || echo 0)" "$1 $3 (got $n)"
}

# 200 on every page
for p in "${PAGES[@]}"; do
  k="$(key "$p")"; s="${!k}"
  check "$([ "$s" = 200 ] && echo 1 || echo 0)" "$p returns 200 (got $s)"
done

# one h1 on homepage
n="$(count '<h1' "$(fname /)")"
check "$([ "$n" = 1 ] && echo 1 || echo 0)" "homepage has exactly one <h1 (got $n)"

# no bailout
for p in "${PAGES[@]}"; do
  absence "$p" 'BAILOUT_TO_CLIENT_SIDE_RENDERING' "has no BAILOUT_TO_CLIENT_SIDE_RENDERING"
done

# canonical and no noindex on indexable pages
for p in "${PAGES[@]}"; do
  f="$(fname "$p")"; c="$(canonical "$f")"; r="$(robots "$f")"
  ok=1; [ -z "$c" ] && ok=0
  case "$r" in *noindex*) ok=0 ;; esac
  check "$ok" "$p has canonical and no noindex (canonical='$c' robots='$r')"
done

# ld+json on category pages and guide
for p in "${CATEGORY_PAGES[@]}" /guides/restaurant-staffing-prices; do
  n="$(count 'application/ld+json' "$(fname "$p")")"
  check "$([ "$n" -ge 1 ] && echo 1 || echo 0)" "$p has at least one ld+json (got $n)"
done

# FAQPage
for p in "${FAQ_PAGES[@]}"; do
  n="$(count 'FAQPage' "$(fname "$p")")"
  check "$([ "$n" -ge 1 ] && echo 1 || echo 0)" "$p has FAQPage (got $n)"
done
absence /category/electrician 'FAQPage' "has no FAQPage"

# 404 for unknown slug
fetch /category/not-a-real-slug
check "$([ "$STATUS" = 404 ] && echo 1 || echo 0)" "/category/not-a-real-slug returns 404 (got $STATUS)"

# coming-soon noindex
fetch /category/plumber
r="$(robots "$(fname /category/plumber)")"
case "$r" in *noindex*) ok=1 ;; *) ok=0 ;; esac
check "$ok" "/category/plumber robots meta contains noindex (robots='$r')"

# sitemap
fetch /sitemap.xml
sf="$(fname /sitemap.xml)"
GOT="$(tr '\n' ' ' < "$sf" | grep -o '<loc>[^<]*</loc>' | sed 's#<loc>##; s#</loc>##' \
  | sed -E 's#^https?://[^/]+##' | sed 's#^$#/#' | sort)"
WANT="$(printf '%s\n' "${EXPECTED_SITEMAP[@]}" | sort)"
echo
echo "sitemap.xml URLs (HTTP $STATUS):"
if [ -n "$GOT" ]; then echo "$GOT" | sed 's/^/  /'; else echo "  (none)"; fi
echo
ok=0; [ "$STATUS" = 200 ] && [ "$GOT" = "$WANT" ] && ok=1
check "$ok" "sitemap.xml lists exactly the Phase 1 URLs"
for slug in "${COMING_SOON[@]}"; do
  if echo "$GOT" | grep -q "/category/$slug\$"; then bad=1; else bad=0; fi
  check "$([ "$bad" = 0 ] && [ "$STATUS" = 200 ] && echo 1 || echo 0)" "sitemap.xml does not list coming-soon $slug"
done

# numeric category links on homepage
absence / 'href="/category/[0-9][0-9]*' "(homepage) has no href=\"/category/<digits>\""

# aggregateRating anywhere
for p in "${PAGES[@]}"; do
  absence "$p" 'aggregateRating' "has no aggregateRating"
done

echo
echo "Summary: $PASSES passed, $FAILS failed"
[ "$FAILS" -eq 0 ] || exit 1
exit 0
