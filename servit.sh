#!/bin/bash
# ─────────────────────────────────────────────────────────
# servit — CLI wrapper for Servit server
# ─────────────────────────────────────────────────────────

INSTALL_DIR="$HOME/.servit"
PIDFILE="/tmp/servit.pid"
LOGFILE="/tmp/servit.log"
TUNNEL_LOGFILE="/tmp/servit-tunnel.log"
TUNNEL_PIDFILE="/tmp/servit-tunnel.pid"

# Find Python
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PYTHON="$cmd"
        break
    fi
done

# Find servit.py — check install dir, then script dir, then cwd
SERVIT_PY=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
for candidate in "$INSTALL_DIR/servit.py" "$SCRIPT_DIR/servit.py" "./servit.py"; do
    if [ -f "$candidate" ]; then
        SERVIT_PY="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Error: Python 3 not found"
    exit 1
fi

if [ -z "$SERVIT_PY" ]; then
    echo "Error: servit.py not found"
    echo "Run install.sh first, or run from the servit directory"
    exit 1
fi

usage() {
    echo "Usage: servit [command] [options]"
    echo ""
    echo "Commands:"
    echo "  (none)          Start Servit server (foreground)"
    echo "  start           Start Servit server (background)"
    echo "  stop            Stop Servit server"
    echo "  restart         Restart Servit server"
    echo "  status          Show server status"
    echo "  url             Show tunnel URL"
    echo "  logs            Show server logs"
    echo ""
    echo "Options:"
    echo "  --port PORT     Server port (default: 8765)"
    echo "  --pass PASS     Single password mode"
    echo "  --accounts STR  Static accounts (user1:pass1,user2:pass2)"
    echo "  --root PATH     Root directory for file browser"
    echo "  --tunnel        Start Cloudflare tunnel for HTTPS access"
    echo "  -h, --help      Show this help"
    echo ""
    echo "Examples:"
    echo "  servit                          # Start with system auth"
    echo "  servit --port 9000              # Custom port"
    echo "  servit --pass secret --tunnel   # Password mode + tunnel"
    echo "  servit start --tunnel           # Background mode + tunnel"
    echo "  servit stop                     # Stop everything"
}

get_port() {
    # Extract port from args, default 8765
    local port=8765
    local args=("$@")
    for ((i=0; i<${#args[@]}; i++)); do
        if [ "${args[$i]}" = "--port" ] && [ $((i+1)) -lt ${#args[@]} ]; then
            port="${args[$((i+1))]}"
            break
        fi
    done
    echo "$port"
}

start_tunnel() {
    local port="$1"
    if ! command -v cloudflared &>/dev/null; then
        echo "cloudflared not found. Install it:"
        echo "  curl -sL https://pkg.cloudflare.com/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared"
        return 1
    fi

    # Kill existing tunnel
    if [ -f "$TUNNEL_PIDFILE" ]; then
        kill "$(cat "$TUNNEL_PIDFILE")" 2>/dev/null
        rm -f "$TUNNEL_PIDFILE"
    fi

    cloudflared tunnel --url "http://localhost:$port" \
        --no-autoupdate \
        > "$TUNNEL_LOGFILE" 2>&1 &
    echo $! > "$TUNNEL_PIDFILE"

    echo "Tunnel starting..."
    # Wait for URL
    for i in $(seq 1 30); do
        url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOGFILE" 2>/dev/null | tail -1)
        if [ -n "$url" ]; then
            echo ""
            echo "  Tunnel URL: $url"
            echo ""
            return 0
        fi
        sleep 1
    done
    echo "  Tunnel URL not yet available. Check: servit url"
}

stop_tunnel() {
    if [ -f "$TUNNEL_PIDFILE" ]; then
        kill "$(cat "$TUNNEL_PIDFILE")" 2>/dev/null
        rm -f "$TUNNEL_PIDFILE"
    fi
}

# Parse first argument as command
CMD="${1:-}"
case "$CMD" in
    stop)
        echo "Stopping Servit..."
        if [ -f "$PIDFILE" ]; then
            kill "$(cat "$PIDFILE")" 2>/dev/null && echo "Server stopped" || echo "Server not running"
            rm -f "$PIDFILE"
        else
            echo "No PID file found"
            # Try to find and kill
            pkill -f "python.*servit.py" 2>/dev/null && echo "Server stopped" || echo "Server not running"
        fi
        stop_tunnel
        echo "Done"
        exit 0
        ;;

    restart)
        shift
        "$0" stop
        sleep 1
        exec "$0" start "$@"
        ;;

    status)
        echo "Servit Status"
        echo "─────────────"
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "  Server:  running (PID $(cat "$PIDFILE"))"
        else
            echo "  Server:  stopped"
        fi
        if [ -f "$TUNNEL_PIDFILE" ] && kill -0 "$(cat "$TUNNEL_PIDFILE")" 2>/dev/null; then
            url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOGFILE" 2>/dev/null | tail -1)
            echo "  Tunnel:  running (PID $(cat "$TUNNEL_PIDFILE"))"
            [ -n "$url" ] && echo "  URL:     $url"
        else
            echo "  Tunnel:  stopped"
        fi
        exit 0
        ;;

    url)
        if [ -f "$TUNNEL_LOGFILE" ]; then
            url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOGFILE" 2>/dev/null | tail -1)
            if [ -n "$url" ]; then
                echo "$url"
            else
                echo "No tunnel URL found"
            fi
        else
            echo "Tunnel not running"
        fi
        exit 0
        ;;

    logs)
        if [ -f "$LOGFILE" ]; then
            tail -f "$LOGFILE"
        else
            echo "No log file found at $LOGFILE"
        fi
        exit 0
        ;;

    -h|--help|help)
        usage
        exit 0
        ;;

    start)
        shift
        # Background mode
        PORT=$(get_port "$@")
        WANT_TUNNEL=false
        PASSTHRU_ARGS=()
        for arg in "$@"; do
            if [ "$arg" = "--tunnel" ]; then
                WANT_TUNNEL=true
            else
                PASSTHRU_ARGS+=("$arg")
            fi
        done

        echo "Starting Servit (background)..."
        nohup "$PYTHON" "$SERVIT_PY" "${PASSTHRU_ARGS[@]}" > "$LOGFILE" 2>&1 &
        echo $! > "$PIDFILE"
        echo "  PID: $(cat "$PIDFILE")"
        echo "  Log: $LOGFILE"
        echo "  URL: http://localhost:$PORT"

        if $WANT_TUNNEL; then
            start_tunnel "$PORT"
        fi
        exit 0
        ;;

    *)
        # Foreground mode — pass all args through
        PORT=$(get_port "$@")
        WANT_TUNNEL=false
        PASSTHRU_ARGS=()
        for arg in "$@"; do
            if [ "$arg" = "--tunnel" ]; then
                WANT_TUNNEL=true
            else
                PASSTHRU_ARGS+=("$arg")
            fi
        done

        if $WANT_TUNNEL; then
            start_tunnel "$PORT"
        fi

        # Run in foreground
        trap 'stop_tunnel; exit 0' INT TERM
        exec "$PYTHON" "$SERVIT_PY" "${PASSTHRU_ARGS[@]}"
        ;;
esac
