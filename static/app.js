/**
 * Servit - Mobile Server Dashboard
 * Terminal + File Explorer + Korean IME Input Bar
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ── State ──────────────────────────────────────
  let ws = null;
  let term = null;
  let fitAddon = null;
  let currentDir = "";
  let userHome = "";
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  let intentionalClose = false;

  // ── Icons ──────────────────────────────────────
  const ICONS = {
    dir: "\uD83D\uDCC1", link: "\uD83D\uDD17", default: "\uD83D\uDCC4",
    ".py": "\uD83D\uDC0D", ".js": "\uD83D\uDCDC", ".ts": "\uD83D\uDCD8",
    ".sh": "\u2699\uFE0F", ".yml": "\uD83D\uDCCB", ".yaml": "\uD83D\uDCCB",
    ".json": "\uD83D\uDCE6", ".md": "\uD83D\uDCDD", ".html": "\uD83C\uDF10",
    ".css": "\uD83C\uDFA8", ".xml": "\uD83D\uDCF0", ".txt": "\uD83D\uDCC3",
    ".csv": "\uD83D\uDCCA", ".log": "\uD83D\uDCC3", ".sql": "\uD83D\uDDC3\uFE0F",
    ".png": "\uD83D\uDDBC\uFE0F", ".jpg": "\uD83D\uDDBC\uFE0F",
    ".pdf": "\uD83D\uDCD5", ".zip": "\uD83D\uDDDC\uFE0F", ".gz": "\uD83D\uDDDC\uFE0F",
    ".xlsx": "\uD83D\uDCCA", ".xls": "\uD83D\uDCCA",
    ".hwp": "\uD83D\uDCC4", ".docx": "\uD83D\uDCC4",
    ".rs": "\uD83E\uDD80", ".go": "\uD83D\uDC39", ".c": "\uD83D\uDD27",
    ".cpp": "\uD83D\uDD27", ".h": "\uD83D\uDD27",
    ".java": "\u2615", ".kt": "\uD83D\uDFE3",
  };

  const fmtSize = (b) =>
    b < 1024 ? b + " B" :
    b < 1048576 ? (b / 1024).toFixed(1) + " KB" :
    (b / 1048576).toFixed(1) + " MB";

  const escHtml = (s) => {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  };

  // ── Toast notifications ────────────────────────
  function showToast(msg, isError) {
    const container = $("#toast-container");
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Sidebar ────────────────────────────────────
  window.toggleSidebar = function () {
    const sidebar = $("#sidebar");
    const backdrop = $("#sidebar-backdrop");
    if (sidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      sidebar.classList.add("open");
      backdrop.classList.add("visible");
      loadTree(currentDir || "");
    }
  };

  window.closeSidebar = function () {
    $("#sidebar").classList.remove("open");
    $("#sidebar-backdrop").classList.remove("visible");
    // Refit after sidebar close animation completes
    setTimeout(doFit, 50);
    setTimeout(doFit, 350);
  };

  // ── File Tree ──────────────────────────────────
  async function loadTree(dir) {
    const hidden = $("#show-hidden")?.checked ? "1" : "0";
    const el = $("#file-list");
    // Show loading state
    el.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      const res = await fetch(`/api/tree?path=${encodeURIComponent(dir || "")}&hidden=${hidden}`);
      if (!res.ok) {
        showToast("서버 오류: " + res.status, true);
        el.innerHTML = '<div class="file-empty">불러오기 실패</div>';
        return;
      }
      const data = await res.json();
      if (data.error) {
        showToast(data.error, true);
        el.innerHTML = '<div class="file-empty">디렉토리 로드 오류</div>';
        return;
      }
      currentDir = data.path;
      if (data.home) userHome = data.home;
      $("#current-path").textContent = shortPath(data.path);
      renderFileList(data);
    } catch (e) {
      showToast("파일 트리 불러오기 실패", true);
      el.innerHTML = '<div class="file-empty">연결 실패</div>';
    }
  }

  function renderFileList(data) {
    const el = $("#file-list");
    el.innerHTML = "";

    if (data.entries.length === 0) {
      el.innerHTML = '<div class="file-empty">빈 디렉토리</div>';
      return;
    }

    data.entries.forEach((entry) => {
      const div = document.createElement("div");
      div.className = `fitem ${entry.is_dir ? "dir" : "file"}`;

      const icon = document.createElement("span");
      icon.className = "fi-icon";
      icon.textContent = ICONS[entry.ext] || (entry.is_dir ? ICONS.dir : ICONS.default);

      const name = document.createElement("span");
      name.className = "fi-name";
      name.textContent = entry.name;

      div.appendChild(icon);
      div.appendChild(name);

      if (!entry.is_dir) {
        const size = document.createElement("span");
        size.className = "fi-size";
        size.textContent = fmtSize(entry.size);
        div.appendChild(size);
      }

      // Tap feedback
      div.addEventListener("touchstart", () => {
        div.classList.add("tap-flash");
      }, { passive: true });
      div.addEventListener("touchend", () => {
        setTimeout(() => div.classList.remove("tap-flash"), 150);
      }, { passive: true });

      div.addEventListener("click", () => {
        if (entry.is_dir) {
          loadTree(entry.path);
        } else {
          openFile(entry.path, entry.name);
          closeSidebar();
        }
      });

      el.appendChild(div);
    });
  }

  window.goParent = () => {
    if (currentDir && currentDir !== "/")
      loadTree(currentDir.replace(/\/[^/]+$/, "") || "/");
  };
  window.goHome = () => loadTree("");
  window.refreshTree = () => loadTree(currentDir);

  // ── File Viewer ────────────────────────────────
  async function openFile(path, name) {
    name = name || path.split("/").pop();

    const viewer = $("#viewer");
    const codeEl = $("#viewer-code");
    const titleEl = $("#viewer-title");
    const infoEl = $("#viewer-info");

    // Reset edit state
    isEditing = false;
    editingPath = "";
    editingContent = "";
    $("#btn-edit").style.display = "none";
    $("#btn-save").style.display = "none";
    $("#btn-cancel").style.display = "none";

    // Reset viewer body to code view
    const viewerBody = $("#viewer-body");
    viewerBody.innerHTML = '<pre><code id="viewer-code"></code></pre>';
    const freshCodeEl = $("#viewer-code");

    viewer.classList.remove("hidden");
    titleEl.textContent = name;
    infoEl.textContent = "불러오는 중...";
    freshCodeEl.textContent = "파일 불러오는 중...";
    freshCodeEl.removeAttribute("data-highlighted");
    freshCodeEl.className = "";

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        freshCodeEl.textContent = `서버 오류: ${res.status}`;
        infoEl.textContent = "오류";
        return;
      }
      const data = await res.json();

      if (data.error) {
        freshCodeEl.textContent = data.error;
        infoEl.textContent = "오류";
        return;
      }

      // Office document renderers
      if (data.type === "excel") {
        infoEl.textContent = `Excel \u00B7 ${fmtSize(data.size)}`;
        renderExcel(data);
        return;
      }
      if (data.type === "docx") {
        infoEl.textContent = `DOCX \u00B7 ${fmtSize(data.size)}`;
        renderDocx(data);
        return;
      }
      if (data.type === "hwp") {
        infoEl.textContent = `HWP \u00B7 ${fmtSize(data.size)}`;
        renderHwp(data);
        return;
      }

      // Show edit button for non-binary, non-truncated text files
      if (!data.binary && !data.truncated) {
        editingPath = path;
        editingContent = data.content;
        $("#btn-edit").style.display = "flex";
      }

      infoEl.textContent = `${data.language} \u00B7 ${fmtSize(data.size)}`;

      const lines = data.content.split("\n");
      const maxLines = Math.min(lines.length, 5000);
      let content = "";
      for (let i = 0; i < maxLines; i++) {
        content += lines[i] + "\n";
      }
      if (lines.length > 5000) {
        content += `\n... (${lines.length - 5000} more lines)`;
      }

      freshCodeEl.textContent = content;

      const langMap = {
        python: "python", javascript: "javascript", typescript: "typescript",
        kotlin: "kotlin", java: "java", bash: "bash",
        yaml: "yaml", json: "json", markdown: "markdown",
        html: "xml", css: "css", xml: "xml",
        groovy: "groovy", sql: "sql", rust: "rust",
        go: "go", c: "c", cpp: "cpp", properties: "properties",
        toml: "ini", text: "plaintext",
      };

      const lang = langMap[data.language] || "plaintext";
      freshCodeEl.className = `language-${lang}`;

      if (window.hljs && lang !== "plaintext") {
        try {
          const result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
          const highlighted = result.value.split("\n");
          let html = "";
          for (let i = 0; i < highlighted.length; i++) {
            html += `<span class="line-num">${i + 1}</span>${highlighted[i]}\n`;
          }
          freshCodeEl.innerHTML = html;
        } catch (e) {
          renderPlainLines(freshCodeEl, content);
        }
      } else {
        renderPlainLines(freshCodeEl, content);
      }
    } catch (e) {
      freshCodeEl.textContent = `오류: ${e.message}`;
      infoEl.textContent = "오류";
    }
  }

  function renderPlainLines(codeEl, content) {
    const lines = content.split("\n");
    let html = "";
    for (let i = 0; i < lines.length; i++) {
      html += `<span class="line-num">${i + 1}</span>${escHtml(lines[i])}\n`;
    }
    codeEl.innerHTML = html;
  }

  window.closeViewer = function () {
    $("#viewer").classList.add("hidden");
    isEditing = false;
    editingPath = "";
    editingContent = "";
    // Refit terminal after viewer closes
    setTimeout(doFit, 50);
    setTimeout(doFit, 300);
  };

  // ── Office Renderers ───────────────────────────
  function renderExcel(data) {
    const body = $("#viewer-body");
    if (data.error || !data.sheets) {
      body.innerHTML = `<div class="doc-error">${escHtml(data.error || "Excel data missing")}</div>`;
      return;
    }
    let html = '<div class="doc-container">';

    if (data.sheets.length > 1) {
      html += '<div class="sheet-tabs">';
      data.sheets.forEach((sheet, i) => {
        html += `<button class="sheet-tab ${i === 0 ? "active" : ""}" onclick="window._switchSheet(${i})">${escHtml(sheet.name)}</button>`;
      });
      html += "</div>";
    }

    data.sheets.forEach((sheet, i) => {
      html += `<div class="sheet-content" id="sheet-${i}" style="${i > 0 ? "display:none" : ""}">`;
      html += `<div class="sheet-info">${escHtml(sheet.name)} -- ${sheet.total_rows} rows x ${sheet.total_cols} cols</div>`;
      html += '<div class="table-wrap"><table class="excel-table">';
      sheet.rows.forEach((row, ri) => {
        html += "<tr>";
        html += `<td class="row-num">${ri + 1}</td>`;
        row.forEach((cell) => {
          const tag = ri === 0 ? "th" : "td";
          html += `<${tag}>${escHtml(cell)}</${tag}>`;
        });
        html += "</tr>";
      });
      if (sheet.total_rows > 500) {
        html += `<tr><td colspan="99" class="truncated">... ${sheet.total_rows - 500} more rows</td></tr>`;
      }
      html += "</table></div></div>";
    });
    html += "</div>";
    body.innerHTML = html;
  }

  window._switchSheet = function (idx) {
    $$(".sheet-content").forEach((el, i) => (el.style.display = i === idx ? "" : "none"));
    $$(".sheet-tab").forEach((el, i) => el.classList.toggle("active", i === idx));
  };

  function renderDocx(data) {
    const body = $("#viewer-body");
    if (data.error || !data.elements) {
      body.innerHTML = `<div class="doc-error">${escHtml(data.error || "DOCX data missing")}</div>`;
      return;
    }
    let html = '<div class="doc-container docx-content">';
    data.elements.forEach((el) => {
      if (el.type === "paragraph") {
        const isH = el.style && el.style.toLowerCase().includes("heading");
        const tag = isH ? (el.style.includes("1") ? "h1" : el.style.includes("2") ? "h2" : "h3") : "p";
        const cls = el.bold && !isH ? ' class="bold"' : "";
        html += `<${tag}${cls}>${escHtml(el.text)}</${tag}>`;
      } else if (el.type === "table") {
        html += '<div class="table-wrap"><table class="docx-table">';
        el.rows.forEach((row, ri) => {
          html += "<tr>";
          row.forEach((cell) => {
            const tag = ri === 0 ? "th" : "td";
            html += `<${tag}>${escHtml(cell)}</${tag}>`;
          });
          html += "</tr>";
        });
        html += "</table></div>";
      }
    });
    html += "</div>";
    body.innerHTML = html;
  }

  function renderHwp(data) {
    const body = $("#viewer-body");
    if (data.error || !data.content) {
      body.innerHTML = `<div class="doc-error">${escHtml(data.error || "HWP data missing")}</div>`;
      return;
    }
    let html = '<div class="doc-container hwp-content">';
    html += '<div class="hwp-notice">HWP text extraction (formatting/images excluded)</div>';
    data.content.split("\n").forEach((p) => {
      if (p.trim()) html += `<p>${escHtml(p)}</p>`;
    });
    html += "</div>";
    body.innerHTML = html;
  }

  // ── Monitor ────────────────────────────────────
  let monitorTimer = null;
  let prevNetwork = null;
  let prevNetworkTime = null;

  window.openMonitor = function () {
    $("#monitor").classList.remove("hidden");
    fetchStats();
    monitorTimer = setInterval(fetchStats, 3000);
  };

  window.closeMonitor = function () {
    $("#monitor").classList.add("hidden");
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
    prevNetwork = null;
    prevNetworkTime = null;
    setTimeout(doFit, 50);
    setTimeout(doFit, 300);
  };

  function barClass(pct) {
    if (pct >= 85) return "danger";
    if (pct >= 60) return "warn";
    return "";
  }

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(1) + " GB";
  }

  function fmtBytesGB(b) {
    return (b / 1073741824).toFixed(1) + " GB";
  }

  function fmtRate(bytesPerSec) {
    if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + " B/s";
    if (bytesPerSec < 1048576) return (bytesPerSec / 1024).toFixed(1) + " KB/s";
    return (bytesPerSec / 1048576).toFixed(1) + " MB/s";
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      const s = await res.json();
      renderMonitor(s);
    } catch (e) {
      /* ignore */
    }
  }

  function renderMonitor(s) {
    const body = $("#monitor-body");
    let html = "";

    // CPU
    const cpuPct = Math.min(s.cpu.percent, 100);
    html += '<div class="stat-card">';
    html += '<div class="stat-label">CPU <span class="stat-value">' + cpuPct + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(cpuPct) + '" style="width:' + cpuPct + '%"></div></div>';
    html += '<div class="stat-detail">Load: ' + s.load[0].toFixed(2) + ' / ' + s.load[1].toFixed(2) + ' / ' + s.load[2].toFixed(2) + '  (' + s.cpu.cores + ' cores)</div>';
    html += '</div>';

    // Memory
    html += '<div class="stat-card">';
    html += '<div class="stat-label">Memory <span class="stat-value">' + s.memory.percent + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(s.memory.percent) + '" style="width:' + s.memory.percent + '%"></div></div>';
    html += '<div class="stat-detail">' + fmtBytesGB(s.memory.used) + ' / ' + fmtBytesGB(s.memory.total) + '</div>';
    html += '</div>';

    // Disk
    html += '<div class="stat-card">';
    html += '<div class="stat-label">Disk <span class="stat-value">' + s.disk.percent + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(s.disk.percent) + '" style="width:' + s.disk.percent + '%"></div></div>';
    html += '<div class="stat-detail">' + fmtBytesGB(s.disk.used) + ' / ' + fmtBytesGB(s.disk.total) + '</div>';
    html += '</div>';

    // GPU
    if (s.gpu && s.gpu.length > 0) {
      s.gpu.forEach(function (gpu, i) {
        var vramPct = gpu.memory_total > 0 ? Math.round(gpu.memory_used / gpu.memory_total * 100) : 0;
        html += '<div class="stat-card gpu-card">';
        html += '<div class="stat-label">GPU ' + i + '</div>';
        html += '<div class="gpu-name">' + escHtml(gpu.name) + '</div>';

        html += '<div class="gpu-metric">';
        html += '<div class="gpu-metric-label"><span>Util</span><span>' + gpu.util + '%</span></div>';
        html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(gpu.util) + '" style="width:' + gpu.util + '%"></div></div>';
        html += '</div>';

        html += '<div class="gpu-metric">';
        html += '<div class="gpu-metric-label"><span>VRAM</span><span>' + vramPct + '%  ' + (gpu.memory_used / 1024).toFixed(1) + '/' + (gpu.memory_total / 1024).toFixed(1) + ' GB</span></div>';
        html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(vramPct) + '" style="width:' + vramPct + '%"></div></div>';
        html += '</div>';

        html += '<div class="stat-detail">Temp: ' + gpu.temp + '\u00B0C</div>';
        html += '</div>';
      });
    }

    // Network + Uptime + Processes
    var netSent = "--";
    var netRecv = "--";
    var now = Date.now();
    if (prevNetwork && prevNetworkTime) {
      var dt = (now - prevNetworkTime) / 1000;
      if (dt > 0) {
        netSent = fmtRate((s.network.bytes_sent - prevNetwork.bytes_sent) / dt);
        netRecv = fmtRate((s.network.bytes_recv - prevNetwork.bytes_recv) / dt);
      }
    }
    prevNetwork = s.network;
    prevNetworkTime = now;

    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-label">Network</div><div class="stat-value">\u2191 ' + netSent + '  \u2193 ' + netRecv + '</div></div>';
    html += '</div>';

    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">' + escHtml(s.uptime) + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Processes</div><div class="stat-value">' + s.processes + '</div></div>';
    html += '</div>';

    body.innerHTML = html;
  }

  // ── File Editor ───────────────────────────────
  let editingPath = "";
  let editingContent = "";
  let isEditing = false;

  window.startEdit = function () {
    if (!editingPath || !editingContent) return;
    isEditing = true;

    var body = $("#viewer-body");
    body.innerHTML = '<textarea id="editor-textarea"></textarea>';
    var ta = $("#editor-textarea");
    ta.value = editingContent;

    $("#btn-edit").style.display = "none";
    $("#btn-save").style.display = "flex";
    $("#btn-cancel").style.display = "flex";
  };

  window.cancelEdit = function () {
    isEditing = false;
    $("#btn-edit").style.display = "flex";
    $("#btn-save").style.display = "none";
    $("#btn-cancel").style.display = "none";

    // Re-render the file
    reRenderViewer();
  };

  function reRenderViewer() {
    var body = $("#viewer-body");
    body.innerHTML = '<pre><code id="viewer-code"></code></pre>';
    var codeEl = $("#viewer-code");

    var lines = editingContent.split("\n");
    var maxLines = Math.min(lines.length, 5000);
    var content = "";
    for (var i = 0; i < maxLines; i++) {
      content += lines[i] + "\n";
    }

    codeEl.textContent = content;

    var ext = editingPath.split(".").pop().toLowerCase();
    var langMap = {
      py: "python", js: "javascript", ts: "typescript",
      kt: "kotlin", java: "java", sh: "bash",
      yml: "yaml", yaml: "yaml", json: "json",
      md: "markdown", html: "xml", css: "css", xml: "xml",
      groovy: "groovy", sql: "sql", rs: "rust",
      go: "go", c: "c", cpp: "cpp", h: "c",
      properties: "properties", toml: "ini", txt: "plaintext",
      csv: "plaintext", log: "plaintext",
    };
    var lang = langMap[ext] || "plaintext";
    codeEl.className = "language-" + lang;

    if (window.hljs && lang !== "plaintext") {
      try {
        var result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
        var highlighted = result.value.split("\n");
        var hhtml = "";
        for (var j = 0; j < highlighted.length; j++) {
          hhtml += '<span class="line-num">' + (j + 1) + '</span>' + highlighted[j] + "\n";
        }
        codeEl.innerHTML = hhtml;
      } catch (e) {
        renderPlainLines(codeEl, content);
      }
    } else {
      renderPlainLines(codeEl, content);
    }
  }

  window.saveEdit = async function () {
    var ta = $("#editor-textarea");
    if (!ta) return;

    var content = ta.value;
    var b64 = btoa(unescape(encodeURIComponent(content)));

    try {
      var res = await fetch("/api/save?path=" + encodeURIComponent(editingPath) + "&b64=" + encodeURIComponent(b64));
      var data = await res.json();
      if (data.ok) {
        editingContent = content;
        isEditing = false;
        $("#btn-edit").style.display = "flex";
        $("#btn-save").style.display = "none";
        $("#btn-cancel").style.display = "none";
        reRenderViewer();
        showToast("저장 완료");
      } else {
        showToast("저장 실패: " + (data.error || "unknown"), true);
      }
    } catch (e) {
      showToast("저장 실패: " + e.message, true);
    }
  };

  // ── Terminal ───────────────────────────────────
  function initTerminal() {
    term = new window.Terminal({
      fontFamily: "'SF Mono', 'Menlo', 'Consolas', 'D2Coding', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f78",
        black: "#484f58", red: "#ff7b72", green: "#3fb950",
        yellow: "#d29922", blue: "#58a6ff", magenta: "#bc8cff",
        cyan: "#39c5cf", white: "#e6edf3",
        brightBlack: "#6e7681", brightRed: "#ffa198", brightGreen: "#56d364",
        brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new window.WebLinksAddon.WebLinksAddon());
    term.open($("#terminal-container"));

    // For ASCII / English direct typing in xterm (still works)
    term.onData((data) => {
      sendWs(data);
    });

    window.addEventListener("resize", doFit);
    // Also refit when orientation changes
    window.addEventListener("orientationchange", () => setTimeout(doFit, 300));

    setTimeout(doFit, 300);
  }

  function doFit() {
    if (!fitAddon) return;
    try {
      fitAddon.fit();
      sendResize();
    } catch (e) {
      /* ignore */
    }
  }

  // ── Korean Input Bar ───────────────────────────
  let inputFocused = false;

  function setupInputBar() {
    const input = $("#korean-input");
    const composingIndicator = $("#input-composing");
    const quickbar = $("#quickbar");
    let composing = false;

    input.addEventListener("compositionstart", () => {
      composing = true;
      composingIndicator.classList.remove("hidden");
    });

    input.addEventListener("compositionend", (e) => {
      composing = false;
      composingIndicator.classList.add("hidden");
      // On some browsers compositionend fires before input event,
      // so we don't clear here -- let sendInputBar handle it
    });

    input.addEventListener("keydown", (e) => {
      if (composing) return;

      if (e.key === "Enter") {
        e.preventDefault();
        sendInputBar();
        return;
      }

      // Forward Ctrl key combos to terminal (Ctrl-C, Ctrl-D, Ctrl-Z, etc.)
      if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        const code = e.key.toLowerCase().charCodeAt(0) - 96; // a=1, b=2, c=3...
        if (code > 0 && code < 27) {
          sendWs(String.fromCharCode(code));
        }
      }
    });

    // Hide quickbar when input is focused (keyboard open) to save space
    input.addEventListener("focus", () => {
      inputFocused = true;
      if (quickbar) quickbar.classList.add("qbar-hidden");
      setTimeout(doFit, 100);
    });

    input.addEventListener("blur", () => {
      inputFocused = false;
      if (quickbar) quickbar.classList.remove("qbar-hidden");
      setTimeout(doFit, 100);
    });

    // Handle iOS visual viewport resize (keyboard appear/disappear)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        doFit();
      });
    }
  }

  // Dismiss keyboard button handler
  window.dismissKeyboard = function () {
    const input = $("#korean-input");
    if (input) input.blur();
  };

  window.sendInputBar = function () {
    const input = $("#korean-input");
    const val = input.value;
    if (val) {
      sendWs(val);
    }
    sendWs("\r");
    input.value = "";
    $("#input-composing").classList.add("hidden");
    // Keep focus on input bar for continuous typing
    input.focus();
  };

  // ── Quick Actions ──────────────────────────────
  window.qType = function (cmd) {
    sendWs(cmd);
    // Don't focus terminal -- avoid triggering keyboard popup on mobile
  };

  window.qSilent = function (key) {
    sendWs(key);
    // Don't focus terminal -- avoid triggering keyboard popup on mobile
  };

  window.doPaste = async function () {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendWs(text);
        showToast(text.length + "자 붙여넣기 완료");
      }
    } catch (e) {
      // Clipboard API not available (common on iOS), fall back to prompt
      const text = prompt("붙여넣기:");
      if (text) sendWs(text);
    }
  };

  // Paste event on document
  document.addEventListener("paste", (e) => {
    // If korean input is focused, let it handle paste naturally
    if (document.activeElement === $("#korean-input")) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (text) sendWs(text);
  });

  // ── Tmux mouse mode ────────────────────────────
  window.tmuxMouseOn = function () {
    // Send Ctrl-b then : to enter tmux command mode
    sendWs("\x02");
    setTimeout(() => {
      sendWs(":");
      setTimeout(() => sendWs("set -g mouse on\n"), 150);
    }, 150);
  };

  // ── Pane Picker ────────────────────────────────
  let paneZoomed = false;

  window.openPanePicker = function () {
    $("#pane-picker").classList.remove("hidden");
  };

  window.closePanePicker = function () {
    if (paneZoomed) {
      sendWs("\x02z");
      paneZoomed = false;
    }
    $("#pane-picker").classList.add("hidden");
    if (term) term.focus();
  };

  window.pickPane = function (n) {
    if (paneZoomed) {
      sendWs("\x02z");
      paneZoomed = false;
    }
    $("#pane-picker").classList.add("hidden");
    sendWs("\x02q");
    setTimeout(() => {
      sendWs(String(n));
      setTimeout(() => {
        sendWs("\x02z");
        paneZoomed = true;
        if (term) term.focus();
      }, 200);
    }, 300);
  };

  window.unzoomPane = function () {
    if (paneZoomed) {
      sendWs("\x02z");
      paneZoomed = false;
    }
    $("#pane-picker").classList.add("hidden");
    if (term) term.focus();
  };

  // ── Quickbar toggle ────────────────────────────
  window.toggleQuickbar = function () {
    const extra = $("#qbar-extra");
    const btn = $("#qbar-toggle");
    if (!extra || !btn) return;
    const isHidden = extra.classList.contains("hidden");
    extra.classList.toggle("hidden");
    btn.textContent = isHidden ? "접기" : "더보기";
    btn.classList.toggle("open", isHidden);
    setTimeout(doFit, 100);
    setTimeout(doFit, 300);
  };

  // ── WebSocket ──────────────────────────────────
  function connect() {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }

    if (ws) {
      intentionalClose = true;
      try { ws.close(); } catch (e) { /* ignore */ }
      ws = null;
    }

    const token = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("token="))
      ?.split("=")[1] || "";
    const proto = location.protocol === "https:" ? "wss:" : "ws:";

    try {
      ws = new WebSocket(`${proto}//${location.host}?token=${token}`);
    } catch (e) {
      showToast("연결 실패", true);
      scheduleReconnect();
      return;
    }

    intentionalClose = false;

    ws.onopen = () => {
      $("#status-dot").classList.add("ok");
      wsReconnectDelay = 1000; // reset backoff
      setTimeout(sendResize, 200);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "output" && term) {
          term.write(msg.data);
        }
      } catch (err) {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      $("#status-dot").classList.remove("ok");
      ws = null;
      if (!intentionalClose) {
        if (term) {
          term.write("\r\n\x1b[38;5;196m[Disconnected]\x1b[0m\r\n");
        }
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose fires after this
    };
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) return;
    const delay = Math.min(wsReconnectDelay, 30000);
    if (term) {
      term.write(`\x1b[38;5;243m[Reconnecting in ${(delay / 1000).toFixed(0)}s...]\x1b[0m\r\n`);
    }
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 30000);
      connect();
    }, delay);
  }

  function sendWs(data) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input", data }));
    }
  }

  function sendResize() {
    if (ws?.readyState === WebSocket.OPEN && term) {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    }
  }

  // ── Helpers ────────────────────────────────────
  function shortPath(p) {
    if (userHome && p.startsWith(userHome)) {
      return "~" + p.slice(userHome.length);
    }
    return p.replace(/^\/home\/[^/]+/, "~");
  }

  // ── Logout ─────────────────────────────────────
  window.logout = function () {
    intentionalClose = true;
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    if (ws) {
      try { ws.close(); } catch (e) { /* ignore */ }
      ws = null;
    }
    document.cookie = "token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure";
    window.location.href = "/login";
  };

  // ── Docker Panel ───────────────────────────────
  window.openDocker = function () {
    $("#docker-panel").classList.remove("hidden");
    refreshDocker();
  };

  window.closeDocker = function () {
    $("#docker-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };

  window.refreshDocker = async function () {
    var body = $("#docker-body");
    body.innerHTML = '<div class="monitor-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/docker?action=list");
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      if (!data.containers || data.containers.length === 0) {
        body.innerHTML = '<div class="file-empty">컨테이너 없음</div>';
        return;
      }
      var html = "";
      data.containers.forEach(function (c) {
        var stateClass = "other";
        if (c.state === "running") stateClass = "running";
        else if (c.state === "exited" || c.state === "stopped") stateClass = "exited";
        html += '<div class="docker-container-card" data-id="' + escHtml(c.id) + '">';
        html += '<div class="docker-container-top">';
        html += '<span class="docker-status-badge ' + stateClass + '"></span>';
        html += '<span class="docker-container-name">' + escHtml(c.name) + '</span>';
        html += '</div>';
        html += '<div class="docker-container-image">' + escHtml(c.image) + '</div>';
        html += '<div class="docker-container-status">' + escHtml(c.status) + '</div>';
        html += '<div class="docker-actions">';
        if (c.state !== "running") {
          html += '<button class="docker-action-btn start" onclick="dockerAction(\'start\',\'' + escHtml(c.id) + '\')">시작</button>';
        } else {
          html += '<button class="docker-action-btn stop" onclick="dockerAction(\'stop\',\'' + escHtml(c.id) + '\')">중지</button>';
        }
        html += '<button class="docker-action-btn restart" onclick="dockerAction(\'restart\',\'' + escHtml(c.id) + '\')">재시작</button>';
        html += '<button class="docker-action-btn logs" onclick="dockerLogs(\'' + escHtml(c.id) + '\')">로그</button>';
        html += '</div>';
        html += '<div id="docker-logs-' + escHtml(c.id.substring(0, 12)) + '"></div>';
        html += '</div>';
      });
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">연결 실패</div>';
    }
  };

  window.dockerAction = async function (action, id) {
    try {
      showToast(action + " 요청 중...");
      var res = await fetch("/api/docker?action=" + action + "&id=" + encodeURIComponent(id));
      var data = await res.json();
      if (data.ok) {
        showToast("완료: " + action);
        setTimeout(refreshDocker, 1000);
      } else {
        showToast(data.error || "실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  window.dockerLogs = async function (id) {
    var el = document.getElementById("docker-logs-" + id.substring(0, 12));
    if (!el) return;
    if (el.innerHTML) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="docker-logs-view">불러오는 중...</div>';
    try {
      var res = await fetch("/api/docker?action=logs&id=" + encodeURIComponent(id) + "&lines=100");
      var data = await res.json();
      el.innerHTML = '<div class="docker-logs-view">' + escHtml(data.logs || "로그 없음") + '</div>';
      var logsDiv = el.querySelector(".docker-logs-view");
      if (logsDiv) logsDiv.scrollTop = logsDiv.scrollHeight;
    } catch (e) {
      el.innerHTML = '<div class="docker-logs-view">로그 불러오기 실패</div>';
    }
  };

  // ── Process Manager (in monitor) ──────────────
  var monitorCurrentTab = "stats";
  var processSortKey = "cpu";
  var processSortDesc = true;

  function renderMonitorWithTabs(s) {
    var body = $("#monitor-body");
    var html = '<div class="monitor-tabs">';
    html += '<button class="monitor-tab ' + (monitorCurrentTab === "stats" ? "active" : "") + '" onclick="switchMonitorTab(\'stats\')">시스템</button>';
    html += '<button class="monitor-tab ' + (monitorCurrentTab === "process" ? "active" : "") + '" onclick="switchMonitorTab(\'process\')">프로세스</button>';
    html += '</div>';

    if (monitorCurrentTab === "stats") {
      html += renderStatsContent(s);
    } else {
      html += '<div id="process-content"><div class="monitor-loading">불러오는 중...</div></div>';
    }

    body.innerHTML = html;

    if (monitorCurrentTab === "process") {
      fetchProcesses();
    }
  }

  function renderStatsContent(s) {
    var html = "";
    var cpuPct = Math.min(s.cpu.percent, 100);
    html += '<div class="stat-card">';
    html += '<div class="stat-label">CPU <span class="stat-value">' + cpuPct + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(cpuPct) + '" style="width:' + cpuPct + '%"></div></div>';
    html += '<div class="stat-detail">Load: ' + s.load[0].toFixed(2) + ' / ' + s.load[1].toFixed(2) + ' / ' + s.load[2].toFixed(2) + '  (' + s.cpu.cores + ' cores)</div>';
    html += '</div>';

    html += '<div class="stat-card">';
    html += '<div class="stat-label">Memory <span class="stat-value">' + s.memory.percent + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(s.memory.percent) + '" style="width:' + s.memory.percent + '%"></div></div>';
    html += '<div class="stat-detail">' + fmtBytesGB(s.memory.used) + ' / ' + fmtBytesGB(s.memory.total) + '</div>';
    html += '</div>';

    html += '<div class="stat-card">';
    html += '<div class="stat-label">Disk <span class="stat-value">' + s.disk.percent + '%</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(s.disk.percent) + '" style="width:' + s.disk.percent + '%"></div></div>';
    html += '<div class="stat-detail">' + fmtBytesGB(s.disk.used) + ' / ' + fmtBytesGB(s.disk.total) + '</div>';
    html += '</div>';

    if (s.gpu && s.gpu.length > 0) {
      s.gpu.forEach(function (gpu, i) {
        var vramPct = gpu.memory_total > 0 ? Math.round(gpu.memory_used / gpu.memory_total * 100) : 0;
        html += '<div class="stat-card gpu-card">';
        html += '<div class="stat-label">GPU ' + i + '</div>';
        html += '<div class="gpu-name">' + escHtml(gpu.name) + '</div>';
        html += '<div class="gpu-metric"><div class="gpu-metric-label"><span>Util</span><span>' + gpu.util + '%</span></div>';
        html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(gpu.util) + '" style="width:' + gpu.util + '%"></div></div></div>';
        html += '<div class="gpu-metric"><div class="gpu-metric-label"><span>VRAM</span><span>' + vramPct + '%  ' + (gpu.memory_used / 1024).toFixed(1) + '/' + (gpu.memory_total / 1024).toFixed(1) + ' GB</span></div>';
        html += '<div class="stat-bar-wrap"><div class="stat-bar ' + barClass(vramPct) + '" style="width:' + vramPct + '%"></div></div></div>';
        html += '<div class="stat-detail">Temp: ' + gpu.temp + '\u00B0C</div>';
        html += '</div>';
      });
    }

    var netSent = "--";
    var netRecv = "--";
    var now = Date.now();
    if (prevNetwork && prevNetworkTime) {
      var dt = (now - prevNetworkTime) / 1000;
      if (dt > 0) {
        netSent = fmtRate((s.network.bytes_sent - prevNetwork.bytes_sent) / dt);
        netRecv = fmtRate((s.network.bytes_recv - prevNetwork.bytes_recv) / dt);
      }
    }
    prevNetwork = s.network;
    prevNetworkTime = now;

    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-label">Network</div><div class="stat-value">\u2191 ' + netSent + '  \u2193 ' + netRecv + '</div></div>';
    html += '</div>';
    html += '<div class="stat-row">';
    html += '<div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">' + escHtml(s.uptime) + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Processes</div><div class="stat-value">' + s.processes + '</div></div>';
    html += '</div>';
    return html;
  }

  window.switchMonitorTab = function (tab) {
    monitorCurrentTab = tab;
    fetchStats();
  };

  var _servitPid = 0;

  async function fetchProcesses() {
    try {
      var res = await fetch("/api/processes");
      var data = await res.json();
      if (data.error) {
        var pc = document.getElementById("process-content");
        if (pc) pc.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      _servitPid = data.servit_pid || 0;
      renderProcessTable(data.processes);
    } catch (e) {
      var pc2 = document.getElementById("process-content");
      if (pc2) pc2.innerHTML = '<div class="file-empty">연결 실패</div>';
    }
  }

  function renderProcessTable(processes) {
    var pc = document.getElementById("process-content");
    if (!pc) return;

    processes.sort(function (a, b) {
      var va = a[processSortKey], vb = b[processSortKey];
      if (typeof va === "number") return processSortDesc ? vb - va : va - vb;
      return processSortDesc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });

    var html = '<table class="process-table"><thead><tr>';
    var cols = [
      { key: "pid", label: "PID" },
      { key: "user", label: "User" },
      { key: "cpu", label: "CPU%" },
      { key: "mem", label: "MEM%" },
      { key: "command", label: "Command" },
    ];
    cols.forEach(function (col) {
      var arrow = processSortKey === col.key ? (processSortDesc ? " \u25BC" : " \u25B2") : "";
      html += '<th onclick="sortProcesses(\'' + col.key + '\')">' + col.label + arrow + '</th>';
    });
    html += '</tr></thead><tbody>';

    processes.forEach(function (p) {
      var cpuClass = p.cpu >= 80 ? "cpu-red" : p.cpu >= 40 ? "cpu-orange" : "cpu-green";
      var memClass = p.mem >= 80 ? "cpu-red" : p.mem >= 40 ? "cpu-orange" : "cpu-green";
      html += '<tr onclick="confirmKill(' + p.pid + ',\'' + escHtml(p.command.substring(0, 40)) + '\')">';
      html += '<td>' + p.pid + '</td>';
      html += '<td>' + escHtml(p.user) + '</td>';
      html += '<td class="' + cpuClass + '">' + p.cpu.toFixed(1) + '</td>';
      html += '<td class="' + memClass + '">' + p.mem.toFixed(1) + '</td>';
      html += '<td><span class="process-cmd">' + escHtml(p.command) + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    pc.innerHTML = html;
  }

  window.sortProcesses = function (key) {
    if (processSortKey === key) processSortDesc = !processSortDesc;
    else { processSortKey = key; processSortDesc = true; }
    fetchProcesses();
  };

  window.confirmKill = function (pid, name) {
    if (pid === _servitPid) {
      showToast("Servit 프로세스는 종료할 수 없습니다", true);
      return;
    }
    if (pid <= 1) {
      showToast("PID 1은 종료할 수 없습니다", true);
      return;
    }
    if (confirm("프로세스 종료?\n\nPID: " + pid + "\n" + name + "\n\n(SIGTERM)")) {
      killProcess(pid, 15);
    }
  };

  async function killProcess(pid, sig) {
    try {
      var res = await fetch("/api/kill?pid=" + pid + "&signal=" + sig);
      var data = await res.json();
      if (data.ok) {
        showToast("PID " + pid + " 종료 요청 전송");
        setTimeout(fetchProcesses, 500);
      } else {
        showToast(data.error || "종료 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  }

  // ── Log Viewer ────────────────────────────────
  var logTailMode = false;
  var logTailTimer = null;
  var currentLogPath = "";

  window.openLogs = function () {
    $("#logs-panel").classList.remove("hidden");
    fetchLogList();
  };

  window.closeLogs = function () {
    $("#logs-panel").classList.add("hidden");
    if (logTailTimer) { clearInterval(logTailTimer); logTailTimer = null; }
    logTailMode = false;
    var btn = document.getElementById("logs-tail-btn");
    if (btn) btn.classList.remove("active");
    currentLogPath = "";
    setTimeout(doFit, 50);
  };

  async function fetchLogList() {
    var el = $("#logs-file-list");
    el.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/logs?action=list");
      var data = await res.json();
      if (!data.files || data.files.length === 0) {
        el.innerHTML = '<div class="file-empty">로그 없음</div>';
        return;
      }
      var html = "";
      data.files.forEach(function (f) {
        html += '<div class="log-file-item" onclick="selectLog(\'' + escHtml(f.path).replace(/'/g, "\\'") + '\')">';
        html += '<span class="log-file-name">' + escHtml(f.name) + '</span>';
        html += '<span class="log-file-size">' + fmtSize(f.size) + '</span>';
        html += '</div>';
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  window.selectLog = async function (path) {
    currentLogPath = path;
    // Highlight active item
    $$(".log-file-item").forEach(function (item) {
      item.classList.remove("active");
      if (item.onclick && item.onclick.toString().indexOf(path) >= 0) {
        item.classList.add("active");
      }
    });
    // Just mark by re-selecting
    var items = $$("#logs-file-list .log-file-item");
    items.forEach(function (item) {
      item.classList.toggle("active", item.querySelector(".log-file-name").textContent === path.split("/").pop() || path === "__journalctl__" && item.querySelector(".log-file-name").textContent.includes("journalctl"));
    });
    await fetchLogContent(path);
  };

  async function fetchLogContent(path) {
    var el = $("#logs-content");
    el.innerHTML = '<div class="file-loading">불러오는 중...</div>';

    var searchQuery = ($("#logs-search") || {}).value || "";

    try {
      var url;
      if (searchQuery) {
        url = "/api/logs?action=search&path=" + encodeURIComponent(path) + "&query=" + encodeURIComponent(searchQuery);
      } else {
        url = "/api/logs?action=read&path=" + encodeURIComponent(path) + "&lines=200";
      }
      var res = await fetch(url);
      var data = await res.json();

      if (data.error) {
        el.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }

      var text = data.content || data.matches || "";
      var lines = text.split("\n");
      var html = "";
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var cls = "";
        if (/error/i.test(line)) cls = "log-error";
        else if (/warn/i.test(line)) cls = "log-warn";
        else if (/info/i.test(line)) cls = "log-info";
        html += '<span class="log-line ' + cls + '"><span class="log-line-num">' + (i + 1) + '</span>' + escHtml(line) + '</span>\n';
      }
      el.innerHTML = html;
      el.scrollTop = el.scrollHeight;
    } catch (e) {
      el.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  window.toggleLogTail = function () {
    logTailMode = !logTailMode;
    var btn = document.getElementById("logs-tail-btn");
    if (btn) btn.classList.toggle("active", logTailMode);
    if (logTailMode && currentLogPath) {
      logTailTimer = setInterval(function () {
        if (currentLogPath) fetchLogContent(currentLogPath);
      }, 2000);
    } else if (logTailTimer) {
      clearInterval(logTailTimer);
      logTailTimer = null;
    }
  };

  // Log search on enter
  (function () {
    setTimeout(function () {
      var searchInput = document.getElementById("logs-search");
      if (searchInput) {
        searchInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && currentLogPath) {
            fetchLogContent(currentLogPath);
          }
        });
      }
    }, 500);
  })();

  // ── Notes Panel ───────────────────────────────
  var currentNoteName = "";
  var noteAutoSaveTimer = null;

  window.openNotes = function () {
    $("#notes-panel").classList.remove("hidden");
    fetchNoteList();
  };

  window.closeNotes = function () {
    flushNoteSave();
    $("#notes-panel").classList.add("hidden");
    currentNoteName = "";
    setTimeout(doFit, 50);
  };

  async function fetchNoteList() {
    var el = $("#notes-list");
    el.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/notes?action=list");
      var data = await res.json();
      var html = "";
      if (data.notes && data.notes.length > 0) {
        data.notes.forEach(function (n) {
          html += '<div class="note-item' + (n.name === currentNoteName ? " active" : "") + '" onclick="selectNote(\'' + escHtml(n.name).replace(/'/g, "\\'") + '\')">' + escHtml(n.name) + '</div>';
        });
      } else {
        html = '<div class="file-empty" style="padding:16px;font-size:12px">메모 없음</div>';
      }
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  window.selectNote = async function (name) {
    // Save current note first
    flushNoteSave();
    currentNoteName = name;

    // Highlight
    $$(".note-item").forEach(function (item) {
      item.classList.toggle("active", item.textContent === name);
    });

    try {
      var res = await fetch("/api/notes?action=read&name=" + encodeURIComponent(name));
      var data = await res.json();
      if (data.error) {
        showToast(data.error, true);
        return;
      }
      $("#notes-editor-header").classList.remove("hidden");
      $("#note-textarea").classList.remove("hidden");
      $("#notes-empty").style.display = "none";
      $("#note-name-input").value = name;
      $("#note-textarea").value = data.content || "";
    } catch (e) {
      showToast("메모 불러오기 실패", true);
    }
  };

  window.createNote = async function () {
    var name = prompt("새 메모 이름:");
    if (!name || !name.trim()) return;
    try {
      var res = await fetch("/api/notes?action=create&name=" + encodeURIComponent(name.trim()));
      var data = await res.json();
      if (data.ok) {
        fetchNoteList();
        selectNote(data.name || name.trim());
      } else {
        showToast(data.error || "생성 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  window.deleteCurrentNote = async function () {
    if (!currentNoteName) return;
    if (!confirm("'" + currentNoteName + "' 메모를 삭제하시겠습니까?")) return;
    try {
      var res = await fetch("/api/notes?action=delete&name=" + encodeURIComponent(currentNoteName));
      var data = await res.json();
      if (data.ok) {
        showToast("삭제 완료");
        currentNoteName = "";
        $("#notes-editor-header").classList.add("hidden");
        $("#note-textarea").classList.add("hidden");
        $("#notes-empty").style.display = "";
        fetchNoteList();
      } else {
        showToast(data.error || "삭제 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  function scheduleNoteSave() {
    if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
    noteAutoSaveTimer = setTimeout(saveCurrentNote, 3000);
  }

  function flushNoteSave() {
    if (noteAutoSaveTimer) {
      clearTimeout(noteAutoSaveTimer);
      noteAutoSaveTimer = null;
    }
    if (currentNoteName) saveCurrentNote();
  }

  async function saveCurrentNote() {
    if (!currentNoteName) return;
    var ta = document.getElementById("note-textarea");
    if (!ta) return;
    var content = ta.value;
    var b64 = btoa(unescape(encodeURIComponent(content)));
    try {
      await fetch("/api/notes?action=save&name=" + encodeURIComponent(currentNoteName) + "&b64=" + encodeURIComponent(b64));
    } catch (e) {
      /* silent */
    }
  }

  // Setup note auto-save
  (function () {
    setTimeout(function () {
      var ta = document.getElementById("note-textarea");
      if (ta) {
        ta.addEventListener("input", scheduleNoteSave);
        ta.addEventListener("blur", function () {
          if (currentNoteName) saveCurrentNote();
        });
      }
    }, 500);
  })();

  // ── Override renderMonitor to use tabs ─────────
  // Replace the original renderMonitor with the tabbed version
  renderMonitor = renderMonitorWithTabs;

  // ── Init ───────────────────────────────────────
  initTerminal();
  setupInputBar();
  connect();

  // No service worker registration -- causes caching issues

})();
