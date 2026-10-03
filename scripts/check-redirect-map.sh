#!/usr/bin/env bash
# Walks every row of docs/seo/404-resolution.md and checks the live URL
# against its expected outcome: 410 (E / unmapped D), 308 to `target` (B/C/
# mapped D), or 200 (A). Group F rows (other hosts) are informational only —
# nothing in this repo can fix them, so they never fail the run.
#
# restocare.in (bare apex) 308s to www.restocare.in for every path on the
# site — a pre-existing, platform-level canonicalization outside this repo's
# next.config.ts/proxy.ts. That hop isn't part of the redirect map this
# script verifies, so bare-apex rows are checked on the www host (where our
# rules actually run); a NOTE line reports the extra apex hop for visibility.
#
# Usage: scripts/check-redirect-map.sh
set -u

DOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs/seo/404-resolution.md"

if [ ! -f "$DOC" ]; then
  echo "Missing $DOC" >&2
  exit 1
fi

pass=0
fail=0
skip=0

# Only the main table's data rows: "| https://... | outcome | target | ... |"
while IFS='|' read -r _ url outcome target _rest; do
  url="$(echo "$url" | sed 's/^ *//; s/ *$//')"
  outcome="$(echo "$outcome" | sed 's/^ *//; s/ *$//')"
  target="$(echo "$target" | sed 's/^ *//; s/ *$//; s/`//g')"

  [ -z "$url" ] && continue
  case "$url" in
  https://*) ;;
  *) continue ;;
  esac

  if [ "$outcome" = "F" ]; then
    status=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url")
    echo "SKIP  $url  (other host, not fixable from this repo — live status: ${status:-no response})"
    skip=$((skip + 1))
    continue
  fi

  # Test on the canonical www host — that's where this repo's redirects()
  # and proxy.ts actually run. Bare apex is checked separately, below.
  test_url="$url"
  case "$url" in
  https://restocare.in/*)
    test_url="https://www.restocare.in/${url#https://restocare.in/}"
    ;;
  esac

  actual_status=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$test_url")
  actual_location=$(curl -s -I -m 10 "$test_url" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/\r$//')

  row_pass=false
  case "$outcome" in
  *410*)
    [ "$actual_status" = "410" ] && row_pass=true
    ;;
  *308*)
    case "$actual_location" in
    "$target" | "$target"'?'*) [ "$actual_status" = "308" ] && row_pass=true ;;
    esac
    ;;
  A*)
    [ "$actual_status" = "200" ] && row_pass=true
    ;;
  *)
    echo "SKIP  $url  (unrecognized outcome '$outcome')"
    skip=$((skip + 1))
    continue
    ;;
  esac

  if [ "$row_pass" = true ]; then
    echo "PASS  $url  -> $actual_status ${actual_location:+$actual_location}"
    pass=$((pass + 1))
  else
    echo "FAIL  $url  ($test_url) expected $outcome -> ${target:-<n/a>}, got $actual_status -> ${actual_location:-<none>}"
    fail=$((fail + 1))
  fi

  if [ "$test_url" != "$url" ]; then
    echo "NOTE  $url  first hops apex -> www (pre-existing platform redirect, outside this repo) before the above rule runs"
  fi
done < <(grep '^| https' "$DOC")

echo
echo "----"
echo "$pass passed, $fail failed, $skip skipped (group F / other hosts)"
[ "$fail" -eq 0 ]
