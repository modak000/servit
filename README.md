# Servit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-yellow.svg)](https://python.org)
[![Single File](https://img.shields.io/badge/Size-150KB-green.svg)](#architecture)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/modak000/servit/pulls)

> 서버를 폰으로 관리하세요. 터미널 + 파일 편집 + 모니터링 + Docker + 로그 -- 파이썬 파일 하나로.

> Manage your Linux server from your phone. Terminal, file editor, monitoring, Docker, logs -- in one Python file.

```
┌─────────────────────────────────────────────┐
│  ☰  Servit  ● Terminal                  ⏻  │
├─────────────────────────────────────────────┤
│                                             │
│  user@server:~/project$ nvidia-smi      │
│  +---------------------+                    │
│  | NVIDIA B200   80GB  |  Temp: 42C         │
│  | GPU-Util: 87%       |  Power: 290W       │
│  +---------------------+                    │
│  user@server:~/project$ _               │
│                                             │
├─────────────────────────────────────────────┤
│ [한글 입력 가능한 입력 바................] [▼] │
├─────────────────────────────────────────────┤
│ ESC  TAB  중지  붙여넣기  Y  N  Pane  더보기 │
└─────────────────────────────────────────────┘
```

---

## 왜 Servit인가? / Why Servit?

**문제**: 서버 관리를 위해 SSH 앱, 파일 관리 앱, 모니터링 앱을 따로 설치해야 합니다. 모바일 SSH에서 한글 입력은 되지 않고, 터미널과 파일 편집을 동시에 할 수 없습니다.

**해결**: Servit은 브라우저 하나로 모든 것을 해결합니다. 150KB, 파이썬 의존성 1개(`websockets`), 설치 10초.

**Problem**: Managing a server from your phone means juggling SSH apps, file managers, and monitoring dashboards. Korean input doesn't work. You can't edit files and use the terminal side by side.

**Solution**: Servit puts everything in one browser tab. 150KB total, one Python dependency, 10-second install.

| | SSH App | Cockpit | Servit |
|---|---|---|---|
| 설치 | 앱 필요 | 300MB+ | **150KB** |
| 한글 입력 | X | X | **O** |
| 파일 편집 | X | 제한적 | **문법 강조** |
| Excel/HWP | X | X | **O** |
| Docker | X | O | **O** |
| 오프라인 PWA | X | X | **O** |
| GPU 모니터링 | X | 플러그인 | **기본 내장** |

---

## 주요 기능 / Features

### 1. 터미널 (Terminal)

xterm.js 기반 풀 터미널. 모바일에서 한글 입력이 완벽하게 됩니다.

```
┌─────────────────────────────────────────────┐
│  ☰  Servit  ● Terminal                  ⏻  │
├─────────────────────────────────────────────┤
│                                             │
│  $ cd ~/project                             │
│  $ git status                               │
│  On branch main                             │
│  Changes not staged for commit:             │
│    modified:   README.md                    │
│                                             │
│  $ claude "이 파일 검토해줘"                  │
│  I'll review the file...                    │
│  $ _                                        │
│                                             │
├─────────────────────────────────────────────┤
│ 조합 중: ㅎㅏㄴ                               │
│ [한글도 입력 가능합니다..............] [▼]    │
├─────────────────────────────────────────────┤
│ ESC  TAB  중지  붙여넣기  Y  N  Pane  더보기 │
│                                             │
│ 더보기 펼침:                                 │
│ ┌─ tmux ──────────────────────────────────┐ │
│ │ 접속  새창  나가기  확대  이동  터치      │ │
│ ├─ Claude Code ───────────────────────────┤ │
│ │ claude  /commit  /help  /clear          │ │
│ ├─ shell ─────────────────────────────────┤ │
│ │ ls -la  cd ..  clear  git st            │ │
│ ├─ sys ───────────────────────────────────┤ │
│ │ gpu  free  disk                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- 하단 입력 바: 한글 조합 완벽 지원 (xterm.js 직접 입력 시 자모 분리 문제 해결)
- 퀵 버튼: ESC, TAB, Ctrl-C, 붙여넣기, Y/N (Claude Code 승인/거부)
- tmux 통합: pane 선택기, 터치 스크롤, 새 창/분리/확대
- Claude Code 전용 버튼

### 2. 파일 탐색기 + 편집기 (File Explorer + Editor)

```
┌──────────────────┬──────────────────────────┐
│  File Explorer   │  servit.py               │
│                  │                          │
│  [상위] [홈] [↻] │  1 │ """                  │
│  [.* 숨김파일]   │  2 │ Servit -- Mobile     │
│                  │  3 │ Server Dashboard     │
│  📁 static/      │  4 │ """                  │
│  📄 install.sh   │  5 │ import asyncio       │
│  📄 LICENSE      │  6 │ import base64        │
│  📄 README.md    │  7 │ import json          │
│  📄 servit.py  ◄ │  8 │ import os            │
│  📄 servit.sh    │  9 │ import pty           │
│                  │ 10 │ import signal        │
│                  │                          │
│                  │  [편집]  [저장]  [닫기]   │
└──────────────────┴──────────────────────────┘
```

- 코드 파일: highlight.js 문법 강조 + 라인 넘버
- Excel (.xlsx): 시트 탭 + HTML 테이블 렌더링
- HWP (.hwp): 텍스트 추출
- DOCX (.docx): 구조화된 표시
- 직접 편집 + 저장 (base64 인코딩 전송)

### 3. 서버 모니터링 (Server Monitoring)

```
┌─────────────────────────────────────────────┐
│  ☰  Servit  ◉ Monitor                  ⏻  │
├─────────────────────────────────────────────┤
│                                             │
│  CPU  ████████████░░░░░░░░  58%   8 cores   │
│  RAM  ██████████████░░░░░░  72%   46/64 GB  │
│  Disk ████░░░░░░░░░░░░░░░░  21%   1.2/5.8T  │
│                                             │
│  ── GPU (NVIDIA) ──────────────────────     │
│  GPU 0  ████████████████░░  87%   B200      │
│  VRAM   ██████████████████  95%   76/80 GB  │
│  Temp   42°C    Power  290W / 700W          │
│                                             │
│  ── Network ───────────────────────────     │
│  ▲ Upload    12.4 MB/s                      │
│  ▼ Download  45.2 MB/s                      │
│                                             │
│  ── Uptime ────────────────────────────     │
│  42 days, 7:23:15                           │
│                                             │
│  Load Average: 3.21 / 2.87 / 2.45          │
│                                             │
├─────────────────────────────────────────────┤
│  Top Processes              [CPU▼] [Kill]   │
│  PID    USER   CPU%  MEM%  COMMAND          │
│  12847  user   87.2  48.1  python train.py  │
│  12901  user   12.5   3.2  nvidia-smi       │
│  1      root    0.1   0.3  systemd          │
└─────────────────────────────────────────────┘
```

- CPU / RAM / Disk 실시간 게이지
- NVIDIA GPU: 사용률, VRAM, 온도, 전력
- 네트워크 송수신 속도
- 프로세스 목록 + kill 기능

### 4. Docker 관리 (Docker Management)

```
┌─────────────────────────────────────────────┐
│  Docker Containers                          │
├─────────────────────────────────────────────┤
│  ● nginx-proxy        Up 3 days             │
│    [Stop] [Restart] [Logs]                  │
│                                             │
│  ● postgres-db        Up 3 days             │
│    [Stop] [Restart] [Logs]                  │
│                                             │
│  ○ redis-cache        Exited (0) 2h ago     │
│    [Start] [Restart] [Logs]                 │
└─────────────────────────────────────────────┘
```

- 컨테이너 목록 (상태 표시)
- 시작 / 중지 / 재시작
- 컨테이너 로그 조회

### 5. 로그 뷰어 (Log Viewer)

```
┌─────────────────────────────────────────────┐
│  Log Files                    [Search: ___] │
├─────────────────────────────────────────────┤
│  📋 journalctl (system)           just now  │
│  📋 syslog                        2 min ago │
│  📋 auth.log                      5 min ago │
│  📋 servit.log                   12 min ago │
├─────────────────────────────────────────────┤
│  syslog (tail -f mode)                      │
│                                             │
│  Apr 16 10:23:01 gpu systemd: Started...    │
│  Apr 16 10:23:05 gpu sshd: Accepted...      │
│  Apr 16 10:23:12 gpu kernel: [INFO] ...     │
│  Apr 16 10:23:15 gpu CRON: (user) CMD...    │
│  Apr 16 10:23:18 gpu kernel: [WARN] ...     │
│                         ^^^^^ 색상 강조      │
└─────────────────────────────────────────────┘
```

- 시스템 로그 파일 탐색
- 검색 + tail 모드 (자동 갱신)
- ERROR / WARN / INFO 색상 하이라이트
- journalctl 통합

### 6. 메모 (Notes)

```
┌─────────────────────────────────────────────┐
│  Notes                          [+ New]     │
├─────────────────────────────────────────────┤
│  📝 server-setup        1.2 KB   2h ago     │
│  📝 todo                0.3 KB   1d ago     │
│  📝 deploy-notes        0.8 KB   3d ago     │
├─────────────────────────────────────────────┤
│  # server-setup                             │
│                                             │
│  GPU 서버 세팅 메모                          │
│  - torch 2.4 설치 완료                      │
│  - CUDA 12.6 확인                           │
│  - venv 경로: /home/user/myproject/venv    │
│                                             │
│                    [Save] [Delete]           │
└─────────────────────────────────────────────┘
```

- 서버에 저장되는 마크다운 메모장
- CRUD: 생성, 읽기, 수정, 삭제
- `~/.servit/notes/` 디렉토리에 `.md` 파일로 저장

---

## 빠른 시작 / Quick Start

### 1. 설치 (10초)

```bash
curl -sL https://raw.githubusercontent.com/modak000/servit/main/install.sh | bash
```

또는 직접:

```bash
git clone https://github.com/modak000/servit.git
cd servit
pip install websockets
```

### 2. 실행

```bash
servit                      # 시스템 계정 인증, 포트 8765
```

### 3. 접속

브라우저에서 `http://서버IP:8765` -- 끝!

iPhone/Android: "홈 화면에 추가"로 앱처럼 사용 (PWA).

---

## 사용법 / Usage

```bash
# 기본 실행 (Linux 시스템 계정 인증)
servit

# 포트 변경
servit --port 9000

# 단일 비밀번호 모드 (간편)
servit --pass mypassword

# 정적 계정 (여러 사용자)
servit --accounts "user1:pass1,user2:pass2"

# 파일 루트 디렉토리 변경
servit --root /var/www

# Cloudflare HTTPS 터널 (외부 접속)
servit --tunnel

# 백그라운드 실행 + 터널
servit start --tunnel

# 중지 / 상태 확인 / URL 확인
servit stop
servit status
servit url
```

### 인증 모드

| 모드 | 옵션 | 설명 |
|---|---|---|
| 시스템 인증 | (기본) | Linux `su` 명령으로 시스템 계정 검증 |
| 단일 비밀번호 | `--pass pw` | 비밀번호만 입력, 사용자명 불필요 |
| 정적 계정 | `--accounts` | 명령줄에 직접 계정 지정 |

---

## 보안 / Security

| 항목 | 설명 |
|---|---|
| 인증 | Linux 시스템 비밀번호 (su 명령 검증) |
| Brute force 방어 | 5분 내 10회 실패 시 10분 잠금 |
| 통신 암호화 | HTTPS (Cloudflare Tunnel 사용 시) |
| 쿠키 | HttpOnly, SameSite=Strict |
| 세션 | 토큰 기반, 메모리 저장 (재시작 시 만료) |
| 파일 접근 | 인증된 사용자의 파일 시스템 권한 적용 |

> **권장**: 외부 접속 시 반드시 `--tunnel` 옵션으로 HTTPS를 사용하세요. HTTP 단독 사용은 로컬 네트워크에서만 권장합니다.

---

## 요구사항 / Requirements

- Linux (Ubuntu, Debian, RHEL, Arch 등)
- Python 3.8+
- `websockets` (`pip install websockets`)

### 선택 사항

| 패키지 | 용도 |
|---|---|
| `openpyxl` | Excel (.xlsx) 파일 보기 |
| `python-docx` | DOCX 파일 보기 |
| `pyhwp` | HWP 파일 보기 |
| `cloudflared` | HTTPS 터널 |
| Docker | Docker 관리 기능 |
| NVIDIA GPU + `nvidia-smi` | GPU 모니터링 |

---

## 아키텍처 / Architecture

```
servit (150KB total)
├── servit.py          47KB   Python server (websockets)
│   ├── HTTP server          REST API + static file serving
│   ├── WebSocket server     PTY-based terminal sessions
│   └── Auth module          system/static/single password
│
└── static/           104KB   Frontend (no build step)
    ├── index.html     16KB   Main app shell
    ├── app.js         53KB   Application logic
    ├── style.css      32KB   Styles (mobile-first)
    ├── login.html      5KB   Login page
    ├── manifest.json   <1KB  PWA manifest
    └── icon.svg        <1KB  App icon

External JS (CDN):
  - xterm.js          Terminal emulator
  - highlight.js      Syntax highlighting

No database. No build tools. No node_modules.
Data stays on your server.
```

---

## API 엔드포인트 / API Endpoints

| Endpoint | 설명 |
|---|---|
| `POST /api/login` | 로그인 (query params: username, password) |
| `GET /api/tree` | 파일 트리 (query: path) |
| `GET /api/file` | 파일 내용 조회 (query: path) |
| `GET /api/save` | 파일 저장 (query: path, b64) |
| `GET /api/search` | 파일 검색 (query: path, q) |
| `GET /api/stats` | 서버 통계 (CPU, RAM, GPU 등) |
| `GET /api/processes` | 프로세스 목록 |
| `GET /api/kill` | 프로세스 종료 (query: pid) |
| `GET /api/docker` | Docker 관리 (query: action) |
| `GET /api/logs` | 로그 뷰어 (query: action, path) |
| `GET /api/notes` | 메모 CRUD (query: action, name, b64) |
| `GET /api/session` | 세션 정보 |
| `WS /ws` | 터미널 WebSocket |

---

## 기여 / Contributing

PR 환영합니다! 이슈를 먼저 열어주세요.

1. Fork
2. Branch (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Pull Request

---

## 라이선스 / License

[MIT License](LICENSE)

---

<p align="center">
<b>Servit</b> -- 서버 관리를 주머니에. Server management in your pocket.
</p>
