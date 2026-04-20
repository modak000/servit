# Servit Market Analysis

## Competitor Comparison

| Tool | Price | Platform | Proxy Jump | File Editor | Monitoring | Docker | Korean IME | Open Source |
|------|-------|----------|------------|-------------|------------|--------|------------|-------------|
| **Termius** | Free / $10/mo Pro | All | Yes (Pro) | No | No | No | System IME | No |
| **JuiceSSH** | Free / $5 Pro IAP | Android only | Yes (via) | No | No | No | System IME | No |
| **Blink Shell** | $20/yr | iOS only | Yes | No | No | No | System IME | Yes (GPLv3) |
| **ServerCat** | Free / $3 Pro IAP | iOS + macOS | Via SSH | No | Yes (CPU/mem/disk/net) | Yes | System IME | No |
| **Prompt 3** | $20/yr or $100 | Apple only | Yes | No | No | No | System IME | No |
| **WebSSH** | Free | Web (Python) | No | No | No | No | System IME | Yes (MIT) |
| **code-server** | Free | Web | No | Yes (VS Code) | No | No | System IME | Yes (MIT) |
| **Portainer** | Free CE / $$ BE | Web | No | No | Container stats | Yes | N/A | Yes (Zlib) |
| **Servit** | **Free** | **Web (any device)** | **Yes** | **Yes** | **Yes (CPU/mem/disk/GPU/net)** | **Yes** | **Dedicated bar** | **Yes (MIT)** |

## Detailed Notes

### Termius
- Most polished cross-platform SSH client. Snippet library, SFTP, port forwarding.
- Pro ($10/mo) required for sync, SFTP, port forwarding, team features.
- No monitoring, no file editing, no Docker. Pure SSH/SFTP client.
- Jump host support in Pro tier only.

### JuiceSSH
- Best-in-class Android SSH. Free tier is generous.
- Pro adds port forwarding, AWS integration, sync, widgets.
- "Connect via" (proxy jump) works well. No server monitoring.
- Android only -- no iOS, no web.

### Blink Shell
- Premium iOS terminal. Mosh support (survives network changes).
- Full SSH implementation: jump hosts, agent forwarding, SFTP.
- Moved from one-time $20 to $20/yr subscription (user backlash).
- No monitoring, no Docker, no file editor. Terminal only.

### ServerCat
- Unique: combines monitoring + Docker + SSH on iOS.
- Agentless -- uses SSH to read /proc, docker commands.
- Closest competitor to Servit's feature set.
- iOS/macOS only. No file editor. No Korean IME bar.

### Prompt 3 (Panic)
- Beautiful design, GPU-accelerated terminal.
- Jump hosts, Secure Enclave keys, Clips (snippets).
- Apple ecosystem only. $20/yr or $100 one-time.
- No monitoring, Docker, or file editing.

### WebSSH (huashengdun/webssh)
- Simple Python web app (tornado + paramiko + xterm.js).
- SSH-only: connect browser to remote servers via a web relay.
- No file browser, no monitoring, no Docker, no proxy jump.
- Closest architectural parallel to Servit but far fewer features.

### code-server
- VS Code in a browser. Excellent editor.
- No terminal management beyond VS Code's integrated terminal.
- No monitoring dashboard, no Docker panel, no mobile optimization.
- Heavy: ~400MB+ install, Node.js dependency.

### Portainer
- Docker/Kubernetes management UI. Best-in-class for containers.
- No SSH terminal, no file browser outside containers, no server monitoring.
- Business Edition is expensive for teams.

## Servit's Unique Positioning

### What no other tool offers in combination:
1. **Web-based + zero install on client** (phone, tablet, any browser)
2. **Terminal + File editor + Monitoring + Docker + Logs + SSH Gateway** in one tool
3. **Dedicated Korean IME input bar** (no other SSH tool has this)
4. **Single Python file, single dependency** (`pip install websockets`)
5. **Proxy jump via terminal** (SSH command injection to existing PTY)
6. **GPU monitoring** (nvidia-smi) built into the dashboard
7. **Free and open source** (MIT license)

### The gap Servit fills:
- ServerCat comes closest but is iOS-only and lacks file editing
- Termius is cross-platform but has no monitoring/Docker and costs $10/mo
- WebSSH is web-based but is SSH-only with no dashboard features
- code-server has a great editor but no monitoring/Docker/mobile optimization

### Target User
**Developer or sysadmin who manages Linux/GPU servers and wants to do everything from their phone.**

Specific personas:
- ML engineer checking GPU training jobs from bed
- Korean developer who needs to type Korean in terminal (unique to Servit)
- Self-hoster who wants one tool instead of Termius + ServerCat + Portainer
- Team lead who needs quick server access without installing apps on every device

### Elevator Pitch
> **Servit: Your entire server in your pocket.**
> One Python file gives you terminal, file editor, system monitoring, Docker management,
> and SSH gateway -- all from your phone's browser. No app install, no subscription,
> no vendor lock-in. With the only dedicated Korean IME bar in any SSH tool.

### Competitive Advantages
| Advantage | vs Termius | vs ServerCat | vs WebSSH | vs code-server |
|-----------|-----------|--------------|-----------|----------------|
| Free forever | $10/mo | $3 IAP | Equal | Equal |
| Any device | Equal | iOS only | Equal | Equal |
| File editor | No editor | No editor | No editor | Better editor |
| Monitoring | No monitoring | Equal | No monitoring | No monitoring |
| Docker | No Docker | Equal | No Docker | No Docker |
| Korean IME | No | No | No | No |
| GPU stats | No | No | No | No |
| Single file deploy | App install | App install | pip install | npm install (heavy) |
| SSH Gateway | Pro only | Via SSH | No | No |
