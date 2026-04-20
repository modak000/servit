# Servit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-yellow.svg)](https://python.org)
[![Single File](https://img.shields.io/badge/Size-150KB-green.svg)](#architecture)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/modak000/servit/pulls)

> **GPU 서버에서 Claude Code 돌리는데, 폰에서 확인하고 싶지 않으세요?**
>
> 학습 상태 확인, Claude Code 승인/거부, 파일 수정, 프로세스 kill — 폰 브라우저 하나로. 파이썬 파일 하나, 150KB.
>
> **Running Claude Code on a GPU server? Manage it from your phone.**
>
> Check training status, approve/reject Claude Code, edit files, kill processes — all from your phone browser. One Python file, 150KB.

<pre>
+-----------------------------------------------+
|  Servit  ● Terminal                        ⏻  |
+-----------------------------------------------+
|                                               |
|  ~$ nvidia-smi                                |
|  +---------------------+                      |
|  | NVIDIA B200   80GB  |  Temp: 42C           |
|  | GPU-Util: 87%       |  Power: 290W         |
|  +---------------------+                      |
|  ~$ _                                         |
|                                               |
+-----------------------------------------------+
|  [Type here (Korean OK)................] [>]  |
+-----------------------------------------------+
|  ESC  TAB  Stop  Paste  Y  N  Pane  More      |
+-----------------------------------------------+
</pre>

---

## Why Servit?

**Problem**: You're running Claude Code or training a model on a GPU server. You step away from your desk. Now what?

- Claude Code asks for approval → you can't respond
- GPU training crashes → you don't know until you're back
- Need to edit one line in a config → have to open laptop
- Disk fills up at 2 AM → no way to check from bed

**Solution**: Servit gives you your entire server in your phone browser. 150KB, one Python dependency, 10 seconds to install.

### Who is this for?

- **AI/ML engineers** — monitor GPU training, check VRAM, kill stuck processes from anywhere
- **Claude Code users** — approve/reject, run commands, check output on your phone
- **DevOps / Sysadmins** — Docker, logs, monitoring without opening a laptop
- **Anyone with a Linux server** — file editing, terminal, system status from any device

### vs Alternatives

|                      | SSH App  | Cockpit  | code-server | **Servit**     |
|----------------------|----------|----------|-------------|----------------|
| Install size         | App req. | 300MB+   | 500MB+      | **150KB**      |
| Claude Code buttons  | No       | No       | No          | **Y/N/commit** |
| GPU monitoring       | No       | Plugin   | No          | **Built-in**   |
| File editor          | No       | Limited  | Full IDE    | **Syntax HL**  |
| Docker mgmt          | No       | Yes      | No          | **Yes**        |
| Korean IME           | No       | No       | Partial     | **Yes**        |
| SSH proxy jump       | Paid     | No       | No          | **Yes**        |
| PWA (Add to Home)    | N/A      | No       | No          | **Yes**        |
| Dependencies         | N/A      | Many     | Node.js     | **1 (pip)**    |

---

## Features

### 1. Terminal

Full terminal with Korean IME input bar. Works with tmux, vim, Claude Code.

<pre>
+-----------------------------------------------+
|  ~$ git status                                |
|  On branch main                               |
|  Changes not staged for commit:               |
|    modified:   README.md                      |
|                                               |
|  ~$ claude "review this file"                 |
|  I'll review the file...                      |
+-----------------------------------------------+
| Composing: han                                |
| [Type here.........................] [v] [>]  |
+-----------------------------------------------+
| ESC  TAB  Stop  Paste  Y  N  Pane  [More]    |
|                                               |
| tmux:  Attach  New  Detach  Zoom  Move  Touch |
| claude:  claude  /commit  /help  /clear       |
| shell:   ls -la  cd ..  clear  git st         |
| sys:     gpu  free  disk                      |
+-----------------------------------------------+
</pre>

- Input bar: full Korean IME support
- Quick buttons: ESC, TAB, Ctrl-C, Paste, Y/N
- tmux: pane picker, touch scroll, new window
- Claude Code: dedicated buttons

### 2. File Explorer + Editor

<pre>
+------------------+----------------------------+
| File Explorer    | servit.py                  |
|                  |                            |
| [Up] [Home] [R]  |  1  """                    |
| [.* hidden]      |  2  Servit -- Mobile       |
|                  |  3  Server Dashboard       |
| D static/        |  4  """                    |
| F install.sh     |  5  import asyncio         |
| F LICENSE        |  6  import base64          |
| F README.md      |  7  import json            |
| F servit.py    < |  8  import os              |
| F servit.sh      |  9  import pty             |
|                  | 10  import signal          |
|                  |                            |
|                  |  [Edit]  [Save]  [Close]   |
+------------------+----------------------------+
</pre>

- Code files: syntax highlighting + line numbers
- Excel (.xlsx): sheet tabs + table rendering
- HWP (.hwp): text extraction
- DOCX (.docx): structured display
- Direct editing + save with auto-backup

### 3. Server Monitoring

<pre>
+-----------------------------------------------+
| System              Processes                  |
+-----------------------------------------------+
|                                               |
| CPU  ============--------  58%    8 cores     |
| RAM  ==============------  72%    46/64 GB    |
| Disk ====----------------  21%    1.2/5.8 TB  |
|                                               |
| -- GPU (NVIDIA) --------------------------    |
| GPU 0  ================--  87%    B200        |
| VRAM   ==================  95%    76/80 GB    |
| Temp   42 C     Power  290W / 700W           |
|                                               |
| -- Network --------------------------------   |
| Up    12.4 MB/s                               |
| Down  45.2 MB/s                               |
|                                               |
| Uptime: 42 days, 7:23                        |
| Load:   3.21 / 2.87 / 2.45                   |
+-----------------------------------------------+
| PID    USER   CPU%  MEM%  COMMAND             |
| 12847  user   87.2  48.1  python train.py     |
| 12901  user   12.5   3.2  nvidia-smi          |
| 1      root    0.1   0.3  systemd             |
+-----------------------------------------------+
</pre>

- Real-time CPU / RAM / Disk gauges
- NVIDIA GPU: utilization, VRAM, temperature
- Network upload/download speed
- Process list with sort + kill

### 4. Docker Management

<pre>
+-----------------------------------------------+
| Docker Containers                    [Refresh] |
+-----------------------------------------------+
| (*) nginx-proxy        Up 3 days              |
|     [Stop] [Restart] [Logs]                   |
|                                               |
| (*) postgres-db        Up 3 days              |
|     [Stop] [Restart] [Logs]                   |
|                                               |
| ( ) redis-cache        Exited (0) 2h ago      |
|     [Start] [Restart] [Logs]                  |
+-----------------------------------------------+
</pre>

- Container list with status
- Start / Stop / Restart
- Container log viewer

### 5. Log Viewer

<pre>
+-----------------------------------------------+
| Log Files                     [Search: ____]  |
+-----------------------------------------------+
| # journalctl (system)            just now     |
| # syslog                         2 min ago    |
| # auth.log                       5 min ago    |
+-----------------------------------------------+
| syslog (tail mode)                            |
|                                               |
| Apr 16 10:23:01 systemd: Started...          |
| Apr 16 10:23:05 sshd: Accepted...            |
| Apr 16 10:23:12 kernel: [INFO] ...           |
| Apr 16 10:23:15 CRON: (user) CMD...          |
| Apr 16 10:23:18 kernel: [WARN] ...           |
+-----------------------------------------------+
</pre>

- System log file browser
- Search + tail mode (auto-refresh)
- ERROR / WARN / INFO color highlighting

### 6. Notes

<pre>
+-----------------------------------------------+
| Notes                             [+ New]     |
+-----------------------------------------------+
| # server-setup        1.2 KB    2h ago        |
| # todo                0.3 KB    1d ago        |
| # deploy-notes        0.8 KB    3d ago        |
+-----------------------------------------------+
| # server-setup                                |
|                                               |
| GPU server setup notes                        |
| - torch 2.4 installed                         |
| - CUDA 12.6 confirmed                         |
|                                               |
|                       [Save] [Delete]         |
+-----------------------------------------------+
</pre>

- Markdown notes saved on server
- Auto-save (3 second debounce)
- Stored in `~/.servit/notes/`

---

## Quick Start

### 1. Install (10 seconds)

```bash
curl -sL https://raw.githubusercontent.com/modak000/servit/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/modak000/servit.git
cd servit
pip install websockets
```

### 2. Run

```bash
servit                          # System auth, port 8765
```

### 3. Open

Browser: `http://your-server:8765`

iPhone/Android: "Add to Home Screen" for app-like PWA experience.

---

## Usage

```bash
# Basic (Linux system account auth)
servit

# Custom port
servit --port 9000

# Single password mode
servit --pass mypassword

# Multiple accounts
servit --accounts "user1:pass1,user2:pass2"

# HTTPS tunnel (external access)
servit --tunnel

# Background + tunnel
servit start --tunnel

# Stop / Status / Tunnel URL
servit stop
servit status
servit url
```

### Remote Access (Phone / External)

Servit runs on your server. To access from your phone, you need to expose it. Here are your options:

| Method | Fixed URL | Free | Setup |
|--------|-----------|------|-------|
| **Same WiFi** | `http://IP:8765` | Yes | None |
| **Tailscale** | `http://100.x.x.x:8765` | Yes (100 devices) | Install on server + phone |
| **ngrok** | `xxx.ngrok-free.app` | Yes (1 free domain) | Sign up + install |
| **Cloudflare Tunnel** | Random URL (changes) | Yes | Install cloudflared |
| **Cloudflare Named** | `servit.yourdomain.com` | Domain needed | Cloudflare account + domain |

#### Option 1: Same WiFi (Easiest)

If your phone and server are on the same network:

```bash
servit
# Open http://YOUR_SERVER_IP:8765 on phone
```

Find your server IP: `hostname -I | awk '{print $1}'`

#### Option 2: Tailscale (Recommended for fixed URL, free)

[Tailscale](https://tailscale.com) creates a private VPN between your devices. Free for up to 100 devices.

```bash
# On server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# On phone: install Tailscale app, sign in with same account

# Then access Servit via Tailscale IP
servit
# Open http://100.x.x.x:8765 on phone (IP is fixed)
```

Tailscale IP never changes. No domain needed. Encrypted.

#### Option 3: ngrok (Free fixed domain)

[ngrok](https://ngrok.com) gives you **1 free fixed domain** on sign-up.

```bash
# Install ngrok and sign up at https://ngrok.com
ngrok config add-authtoken YOUR_TOKEN

# Run Servit + ngrok
servit &
ngrok http 8765 --domain your-name.ngrok-free.app

# Access: https://your-name.ngrok-free.app (fixed, HTTPS)
```

#### Option 4: Cloudflare Quick Tunnel (Free, URL changes)

```bash
servit --tunnel
servit url        # Show the generated URL
```

URL changes on restart. Good for quick/temporary access.

#### Option 5: Cloudflare Named Tunnel (Fixed URL, domain needed)

Requires a domain ($10-15/year) and free Cloudflare account.

```bash
# One-time setup
cloudflared tunnel login
cloudflared tunnel create servit
cloudflared tunnel route dns servit servit.yourdomain.com

# Run
cloudflared tunnel --url http://localhost:8765 run servit

# Access: https://servit.yourdomain.com (fixed, HTTPS)
```

### Auth Modes

| Mode            | Option       | Description                    |
|-----------------|--------------|--------------------------------|
| System auth     | (default)    | Linux `su` password validation |
| Single password | `--pass pw`  | Password only, no username     |
| Static accounts | `--accounts` | Define accounts on command line |

---

## Security

| Feature             | Description                                     |
|---------------------|-------------------------------------------------|
| Auth transmission   | Authorization header (no password in URL)        |
| Auth method         | Linux system password (su verification)          |
| Brute force         | 10 attempts / 5 min, then 10 min lockout         |
| API rate limit      | 100 requests/min per IP, 429 on exceed           |
| Encryption          | HTTPS via Cloudflare Tunnel                      |
| Cookies             | HttpOnly, SameSite=Strict                        |
| Sessions            | Token-based, memory-only (expires on restart)    |
| File access         | Restricted to home directory                     |
| Process kill        | Own processes only (UID check)                   |
| File save           | Auto-backup (.servit-bak) before overwrite       |
| Docker ID           | Regex-validated container IDs                    |
| Security headers    | X-Frame-Options, CSP, X-Content-Type-Options     |

> **Recommended**: Always use `--tunnel` for HTTPS when accessing externally.

---

## Requirements

- Linux (Ubuntu, Debian, RHEL, Arch, etc.)
- Python 3.8+
- `websockets` (`pip install websockets`)

### Optional

| Package       | Purpose              |
|---------------|----------------------|
| `openpyxl`    | Excel (.xlsx) viewer |
| `python-docx` | DOCX viewer         |
| `pyhwp`       | HWP viewer           |
| `cloudflared` | HTTPS tunnel         |
| Docker        | Container management |
| NVIDIA GPU    | GPU monitoring       |

---

## Architecture

```
servit (150KB total)
|
|-- servit.py         47KB   Python server (websockets)
|   |-- HTTP server          REST API + static files
|   |-- WebSocket server     PTY terminal sessions
|   |-- Auth module          system / static / single password
|   |-- Security             rate limit, path restriction, backup
|   `-- Parsers              Excel, HWP, DOCX
|
`-- static/           104KB  Frontend (no build step)
    |-- index.html     16KB  App shell
    |-- app.js         53KB  Application logic
    |-- style.css      32KB  Styles (mobile-first)
    |-- login.html      5KB  Login page
    |-- manifest.json   <1KB PWA manifest
    `-- icon.svg        <1KB App icon

External (CDN, loaded by browser):
  - xterm.js            Terminal emulator
  - highlight.js        Syntax highlighting

No database. No build tools. No node_modules.
All data stays on your server.
```

---

## API Reference

| Endpoint         | Method | Description                          |
|------------------|--------|--------------------------------------|
| `/api/login`     | GET    | Login (Authorization: Basic header)  |
| `/api/tree`      | GET    | File tree (query: path)              |
| `/api/file`      | GET    | Read file (query: path)              |
| `/api/save`      | GET    | Save file (query: path, b64)         |
| `/api/search`    | GET    | Search files (query: path, q)        |
| `/api/stats`     | GET    | Server stats (CPU, RAM, GPU)         |
| `/api/processes` | GET    | Process list                         |
| `/api/kill`      | GET    | Kill process (query: pid, signal)    |
| `/api/docker`    | GET    | Docker management (query: action)    |
| `/api/logs`      | GET    | Log viewer (query: action, path)     |
| `/api/notes`     | GET    | Notes CRUD (query: action, name)     |
| `/api/session`   | GET    | Session info                         |
| WebSocket `/`    | WS     | Terminal session                     |

---

## Contributing

PRs welcome! Please open an issue first.

1. Fork
2. Branch (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Pull Request

---

## License

[MIT License](LICENSE)

---

<p align="center">
<b>Servit</b> — Server management in your pocket.
</p>
