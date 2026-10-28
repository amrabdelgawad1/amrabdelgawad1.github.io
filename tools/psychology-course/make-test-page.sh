#!/usr/bin/env bash
# Local test page for /app/psychology/ (git ignores both files). Usage: bash tools/psychology-course/make-test-page.sh <content.json>
# Then serve the repo root (python3 -m http.server 8765) and open http://localhost:8765/app/psychology/_test.html
set -e
cd "$(dirname "$0")/../.."
cp "$1" app/psychology/_test-content.json
sed -e 's#<script src="gate.js\(?v=[0-9]*\)"></script>#<script>window.PSY_TEST = { content:"_test-content.json", owner:location.search.indexOf("owner") >= 0 };</script>\n<script src="gate.js\1"></script>#' \
    -e 's#<script src="https://cdn.jsdelivr.net[^<]*</script>##' -e '/Content-Security-Policy/d' app/psychology/index.html > app/psychology/_test.html
echo "Test page ready: app/psychology/_test.html"
