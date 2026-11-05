#!/usr/bin/env bash
# This repo is public. Course answers, reviewer keys, database migrations and
# dev tools belong in the private talents-database repo, never here.
# Used by the "Guard private files" check and as the first step of the deploy.
fail=0
paths=$(git ls-files | grep -E '^(supabase|tools|course-kit)/|(^|/)module-[0-9]+\.json$') || [ $? -eq 1 ] || exit 2
if [ -n "$paths" ]; then
  echo "::error::These files belong in the private repo, not here:"
  echo "$paths"
  fail=1
fi
answers=$(git grep -lIE "[\"']?correct[\"']?[[:space:]]*[:,][[:space:]]*(true|!0)|reviewerAnswerKey" -- . ':!.github/guard-private-files.sh') || [ $? -eq 1 ] || exit 2
if [ -n "$answers" ]; then
  echo "::error::These files contain quiz answers or a reviewer key:"
  echo "$answers"
  fail=1
fi
if [ "$fail" = 0 ]; then echo "No private course files found."; fi
exit $fail
