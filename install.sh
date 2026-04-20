#!/bin/bash
# ─────────────────────────────────────────────────────────
# Servit Installer
# Usage: curl -sL https://raw.githubusercontent.com/modak000/servit/main/install.sh | bash
# ─────────────────────────────────────────────────────────
set -e

REPO="https://raw.githubusercontent.com/modak000/servit/main"
INSTALL_DIR="$HOME/.servit"
BIN_DIR=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[*]${NC} $1"; }
ok()    { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[x]${NC} $1"; }

echo ""
echo -e "${BOLD}  Servit Installer${NC}"
echo -e "  Mobile Server Dashboard"
echo ""

# ── Check Python ────────────────────────────────────────
info "Checking Python..."
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        ver=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
        major=$(echo "$ver" | cut -d. -f1)
        minor=$(echo "$ver" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
            PYTHON="$cmd"
            ok "Found $cmd ($ver)"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    fail "Python 3.8+ is required but not found."
    echo ""
    echo "  Install Python:"
    echo "    Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "    RHEL/CentOS:   sudo dnf install python3 python3-pip"
    echo "    macOS:          brew install python3"
    echo ""
    exit 1
fi

# ── Install pip dependencies ────────────────────────────
info "Installing websockets (required)..."
pip_install() {
    "$PYTHON" -m pip install --user "$@" 2>/dev/null \
        || "$PYTHON" -m pip install --user --break-system-packages "$@" 2>/dev/null \
        || "$PYTHON" -m pip install "$@" 2>/dev/null \
        || return 1
}

if pip_install websockets; then
    ok "websockets installed"
else
    fail "Failed to install websockets. Please install manually:"
    echo "    $PYTHON -m pip install websockets"
    exit 1
fi

info "Installing optional dependencies..."
for pkg in openpyxl python-docx pyhwp; do
    if pip_install "$pkg" 2>/dev/null; then
        ok "$pkg installed"
    else
        warn "$pkg skipped (optional -- $pkg viewing won't work)"
    fi
done

# ── Download/copy files ────────────────────────────────
info "Setting up $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR/static"

# Detect if running from cloned repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
if [ -f "$SCRIPT_DIR/servit.py" ] && [ -f "$SCRIPT_DIR/static/index.html" ]; then
    info "Installing from local files..."
    cp "$SCRIPT_DIR/servit.py" "$INSTALL_DIR/"
    cp "$SCRIPT_DIR/servit.sh" "$INSTALL_DIR/"
    cp "$SCRIPT_DIR/static/"* "$INSTALL_DIR/static/"
else
    info "Downloading from GitHub..."
    for f in servit.py servit.sh; do
        curl -sL "$REPO/$f" -o "$INSTALL_DIR/$f" || { fail "Failed to download $f"; exit 1; }
    done
    for f in index.html app.js style.css login.html manifest.json icon.svg; do
        curl -sL "$REPO/static/$f" -o "$INSTALL_DIR/static/$f" || { fail "Failed to download static/$f"; exit 1; }
    done
fi

chmod +x "$INSTALL_DIR/servit.sh"
ok "Files installed to $INSTALL_DIR"

# ── Create bin symlink ──────────────────────────────────
info "Creating 'servit' command..."
if [ -d "$HOME/bin" ]; then
    BIN_DIR="$HOME/bin"
elif [ -d "$HOME/.local/bin" ]; then
    BIN_DIR="$HOME/.local/bin"
else
    mkdir -p "$HOME/.local/bin"
    BIN_DIR="$HOME/.local/bin"
fi

ln -sf "$INSTALL_DIR/servit.sh" "$BIN_DIR/servit"
ok "Created $BIN_DIR/servit"

# Check if BIN_DIR is in PATH
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    warn "$BIN_DIR is not in your PATH."
    echo ""
    echo "  Add to your shell profile:"
    echo "    echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.bashrc"
    echo "    source ~/.bashrc"
    echo ""
fi

# ── Optional: systemd user service ──────────────────────
echo ""
read -p "Set up systemd user service (auto-start on boot)? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SYSTEMD_DIR"

    cat > "$SYSTEMD_DIR/servit.service" << SVCEOF
[Unit]
Description=Servit - Mobile Server Dashboard
After=network.target

[Service]
Type=simple
ExecStart=$PYTHON $INSTALL_DIR/servit.py
Restart=on-failure
RestartSec=5
Environment=LANG=ko_KR.UTF-8

[Install]
WantedBy=default.target
SVCEOF

    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable servit 2>/dev/null || true
    ok "systemd service created: servit"
    echo "    Start:  systemctl --user start servit"
    echo "    Status: systemctl --user status servit"
    echo "    Logs:   journalctl --user -u servit -f"
fi

# ── Optional: cloudflared ───────────────────────────────
echo ""
if command -v cloudflared &>/dev/null; then
    ok "cloudflared already installed"
else
    read -p "Install cloudflared (for HTTPS tunnels)? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Installing cloudflared..."
        if command -v apt &>/dev/null; then
            # Debian/Ubuntu
            curl -sL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null 2>&1
            echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null 2>&1
            sudo apt update -qq 2>/dev/null && sudo apt install -y -qq cloudflared 2>/dev/null && ok "cloudflared installed" || warn "cloudflared install failed (optional)"
        elif command -v dnf &>/dev/null; then
            # RHEL/CentOS
            sudo dnf install -y cloudflared 2>/dev/null && ok "cloudflared installed" || warn "cloudflared install failed (optional)"
        else
            # Binary fallback
            curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o /tmp/cloudflared && chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared /usr/local/bin/ && ok "cloudflared installed" || warn "cloudflared install failed (optional)"
        fi
    fi
fi

# ── Done ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  Servit installed successfully!${NC}"
echo ""
echo "  Start server:"
echo "    servit"
echo ""
echo "  With HTTPS tunnel:"
echo "    servit --tunnel"
echo ""
echo "  Custom port:"
echo "    servit --port 9000"
echo ""
echo "  Single password (no system auth):"
echo "    servit --pass mypassword"
echo ""
echo "  Open in browser:"
echo "    http://localhost:8765"
echo ""
