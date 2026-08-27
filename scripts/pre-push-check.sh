#!/usr/bin/env bash
# Pre-push secret scan. Run before `git push`, or wire it up as a hook:
#   ln -sf ../../scripts/pre-push-check.sh .git/hooks/pre-push
set -uo pipefail

fail=0
note() { printf '  %s\n' "$1"; }
bad()  { printf '  \033[31mBLOCK\033[0m  %s\n' "$1"; fail=1; }
ok()   { printf '  \033[32mok\033[0m     %s\n' "$1"; }

echo "Pre-push secret scan"
echo

# 1. Risky filenames staged or committed
echo "Filenames:"
risky=$(git ls-files | grep -iE '(^|/)\.env$|(^|/)\.env\.(local|production|staging)$|\.key$|\.pem$|credentials\.json$|service-account\.json$|secrets\.json$|id_rsa$|\.npmrc$|\.pypirc$|\.sqlite3?$|\.db$' || true)
if [ -n "$risky" ]; then
  while IFS= read -r f; do bad "tracked sensitive file: $f"; done <<< "$risky"
else
  ok "no sensitive filenames tracked"
fi
echo

# 2. Secret-shaped strings in tracked content
echo "Content:"
pattern='sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}|tvly-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
hits=$(git grep -nIE "$pattern" -- . ':!scripts/pre-push-check.sh' ':!.env.example' 2>/dev/null || true)
if [ -n "$hits" ]; then
  while IFS= read -r h; do bad "secret-shaped string: ${h%%:*}"; done <<< "$hits"
else
  ok "no secret-shaped strings in tracked files"
fi
echo

# 3. .env must never be tracked, and must be ignored
echo "Env hygiene:"
git ls-files --error-unmatch .env >/dev/null 2>&1 && bad ".env is TRACKED — remove with: git rm --cached .env" || ok ".env not tracked"
if [ -f .env ]; then
  git check-ignore -q .env && ok ".env exists locally and is git-ignored" || bad ".env exists but is NOT ignored"
fi
[ -f .env.example ] && ok ".env.example present" || note ".env.example missing — consider adding a template"
echo

if [ "$fail" -ne 0 ]; then
  echo "PUSH BLOCKED — resolve the items above, and rotate any exposed key."
  exit 1
fi
echo "All checks passed — safe to push."
