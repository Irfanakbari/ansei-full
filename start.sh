#!/bin/bash
set -e

# Determine target service:
# Priority 1: SERVICE_ROLE / ROLE / APP_TYPE environment variable (if explicitly set)
# Priority 2: First CLI argument ($1)
# Default: 'api'
if [ -n "$SERVICE_ROLE" ]; then
  TARGET="$SERVICE_ROLE"
elif [ -n "$ROLE" ]; then
  TARGET="$ROLE"
elif [ -n "$APP_TYPE" ]; then
  TARGET="$APP_TYPE"
elif [ -n "$1" ]; then
  TARGET="$1"
else
  TARGET="api"
fi

case "$TARGET" in
  api|backend)
    echo "[ANSEI] Starting API server on port ${PORT:-7500}..."
    exec node apps/api/dist/src/main.js
    ;;

  web|frontend)
    echo "[ANSEI] Starting Web frontend on port ${PORT:-3005}..."
    if [ -d "/app/web-runtime" ]; then
      cd /app/web-runtime && exec node apps/web/server.js
    else
      echo "[ANSEI] Error: /app/web-runtime not found" >&2
      exit 1
    fi
    ;;

  printer|worker)
    echo "[ANSEI] Starting Printer worker..."
    exec node apps/printer/dist/main.js
    ;;

  all|monolith)
    echo "[ANSEI] Starting all services in single container mode..."
    trap 'kill -TERM $PRINTER_PID $API_PID $WEB_PID 2>/dev/null' SIGTERM SIGINT

    echo "[ANSEI] Starting printer worker..."
    node apps/printer/dist/main.js &
    PRINTER_PID=$!

    echo "[ANSEI] Starting API server..."
    node apps/api/dist/src/main.js &
    API_PID=$!

    if [ -f "/app/web-runtime/apps/web/server.js" ]; then
      echo "[ANSEI] Starting Web frontend..."
      (cd /app/web-runtime && node apps/web/server.js) &
      WEB_PID=$!
      wait -n $PRINTER_PID $API_PID $WEB_PID
    else
      wait -n $PRINTER_PID $API_PID
    fi

    EXIT_CODE=$?
    echo "[ANSEI] A service exited with code $EXIT_CODE. Stopping remaining services..."
    kill -TERM $PRINTER_PID $API_PID $WEB_PID 2>/dev/null || true
    exit $EXIT_CODE
    ;;

  *)
    if [ "$#" -gt 0 ]; then
      exec "$@"
    else
      echo "[ANSEI] Defaulting to API server..."
      exec node apps/api/dist/src/main.js
    fi
    ;;
esac
