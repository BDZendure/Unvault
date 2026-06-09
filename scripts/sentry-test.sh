#!/usr/bin/env bash
# End-to-end test of the configured Sentry DSN via sentry-cli.
# Sends a synthetic exception event tagged with a unique marker, then
# polls the Sentry REST API to confirm the event arrived.

set -euo pipefail

cd "$(dirname "$0")/.."

# Load env from .env.local without leaking it to stdout.
set -a
# shellcheck disable=SC1091
source .env.local
set +a

: "${NEXT_PUBLIC_SENTRY_DSN:?NEXT_PUBLIC_SENTRY_DSN missing}"
: "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN missing}"
: "${SENTRY_ORG:?SENTRY_ORG missing}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT missing}"

export SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN"

MARKER="unvault-cli-e2e-$(date +%s)-$$"
EVENT_JSON=$(mktemp -t sentry-event.XXXXXX.json)
trap 'rm -f "$EVENT_JSON"' EXIT

cat > "$EVENT_JSON" <<EOF
{
  "message": "$MARKER",
  "level": "error",
  "platform": "other",
  "logger": "unvault.sentry-cli-test",
  "tags": { "marker": "$MARKER", "source": "sentry-cli-e2e" },
  "exception": {
    "values": [
      {
        "type": "SentryIntegrationTest",
        "value": "$MARKER: synthetic exception from sentry-cli end-to-end test"
      }
    ]
  }
}
EOF

echo "marker: $MARKER"
echo "sending event via sentry-cli..."
DISPATCH=$(sentry-cli send-event "$EVENT_JSON" 2>&1)
echo "$DISPATCH"
EVENT_ID=$(printf '%s' "$DISPATCH" | sed -nE 's/.*dispatched: ([0-9a-f-]+).*/\1/p')
if [ -z "$EVENT_ID" ]; then
  echo "FAIL: sentry-cli did not return a dispatched event ID" >&2
  exit 1
fi

# Try to verify post-ingest visibility via the Sentry REST API.
# Requires an auth token with event:read scope. The token wired in for
# CI source-map uploads typically only has org:ci, which returns 403 here.
API="https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/events/?query=marker:${MARKER}"
echo "polling: $API"

VERIFIED=0
for i in $(seq 1 12); do
  sleep 5
  RESPONSE=$(curl -sS -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" "$API")
  STATUS=$(printf '%s' "$RESPONSE" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("invalid"); sys.exit()
if isinstance(data, dict) and "detail" in data:
    print("forbidden:" + str(data.get("detail")))
elif isinstance(data, list):
    print("ok:" + str(len(data)))
else:
    print("unknown")
')
  case "$STATUS" in
    ok:0)
      echo "  attempt $i: not yet indexed" ;;
    ok:*)
      COUNT=${STATUS#ok:}
      echo "verified: $COUNT event(s) with marker=$MARKER visible in Sentry after ${i}x5s"
      printf '%s' "$RESPONSE" | python3 -c '
import json, sys
for e in json.load(sys.stdin):
    print("  - eventID={} title={} dateCreated={}".format(
        e.get("eventID"), e.get("title"), e.get("dateCreated")))
'
      VERIFIED=1
      break ;;
    forbidden:*)
      echo "  cannot verify via API: ${STATUS#forbidden:}"
      echo "  the configured SENTRY_AUTH_TOKEN has scope 'org:ci' (sufficient for ingest"
      echo "  and source-map upload, but not 'event:read'). Open the Sentry UI to confirm:"
      echo "    https://${SENTRY_ORG}.sentry.io/issues/?project=&query=marker:${MARKER}"
      echo "  event was dispatched: id=${EVENT_ID}"
      exit 2 ;;
    *)
      echo "  unexpected API response: $STATUS"
      echo "$RESPONSE" | head -c 500
      echo
      exit 1 ;;
  esac
done

if [ "$VERIFIED" -ne 1 ]; then
  echo "FAIL: marker $MARKER not visible in Sentry after 60s" >&2
  exit 1
fi
