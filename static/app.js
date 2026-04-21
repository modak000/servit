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
    el.addEventListener("animationend", (e) => {
      if (e.animationName === "toastOut") el.remove();
    });
    // Fallback removal
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3500);
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
    $("#btn-download").style.display = "none";

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

      // Image files — render as image
      if (data.image) {
        infoEl.textContent = "Image \u00B7 " + fmtSize(data.size);
        renderImage(data);
        return;
      }

      // Show edit button for non-binary, non-truncated text files
      editingPath = path;
      if (!data.binary && !data.truncated) {
        editingContent = data.content;
        $("#btn-edit").style.display = "flex";
      }
      // Always show download button
      $("#btn-download").style.display = "flex";

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
    monitorTimer = setInterval(fetchStats, 5000);
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

    // For ASCII / English direct typing in xterm
    // Block when korean input bar is focused (prevents jamo leaking)
    term.onData((data) => {
      if (inputFocused) return;
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
      // iOS: scroll input into view above keyboard
      setTimeout(() => {
        input.scrollIntoView({ block: "end", behavior: "smooth" });
        doFit();
      }, 300);
    });

    input.addEventListener("blur", () => {
      inputFocused = false;
      if (quickbar) quickbar.classList.remove("qbar-hidden");
      setTimeout(doFit, 100);
    });

    // Handle iOS visual viewport resize (keyboard appear/disappear)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        // Adjust input bar position based on visible viewport
        const vv = window.visualViewport;
        const bar = $("#input-bar");
        if (bar && inputFocused) {
          const offset = window.innerHeight - vv.height - vv.offsetTop;
          bar.style.transform = offset > 0 ? `translateY(-${offset}px)` : "";
        } else if (bar) {
          bar.style.transform = "";
        }
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
    btn.textContent = isHidden ? "접기" : "More";
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
      $("#topbar-label").textContent = "Terminal";
      wsReconnectDelay = 1000; // reset backoff
      setTimeout(sendResize, 200);

      // Auto-SSH: check if login page set a target
      setTimeout(function() {
        try {
          var sshData = sessionStorage.getItem("servit_auto_ssh");
          if (sshData) {
            sessionStorage.removeItem("servit_auto_ssh");
            var ssh = JSON.parse(sshData);
            if (ssh && ssh.host) {
              var cmd = "ssh";
              if (ssh.jumpHost) {
                cmd += " -J " + ssh.jumpHost;
              }
              cmd += " -o StrictHostKeyChecking=accept-new";
              if (ssh.port && ssh.port !== 22) {
                cmd += " -p " + ssh.port;
              }
              cmd += " " + ssh.host;
              showToast("SSH 연결 중: " + ssh.host);
              sendWs(cmd + "\n");
            }
          }
        } catch (e) {
          /* ignore auto-ssh errors */
        }
      }, 500);
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
      $("#topbar-label").textContent = "Disconnected";
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
    var indicator = document.getElementById("note-save-status");
    if (indicator) { indicator.textContent = ""; indicator.className = "note-save-indicator"; }
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
    var indicator = document.getElementById("note-save-status");
    var content = ta.value;
    var b64 = btoa(unescape(encodeURIComponent(content)));
    if (indicator) { indicator.textContent = "저장 중..."; indicator.className = "note-save-indicator saving"; }
    try {
      await fetch("/api/notes?action=save&name=" + encodeURIComponent(currentNoteName) + "&b64=" + encodeURIComponent(b64));
      if (indicator) { indicator.textContent = "저장됨"; indicator.className = "note-save-indicator saved"; }
    } catch (e) {
      if (indicator) { indicator.textContent = "저장 실패"; indicator.className = "note-save-indicator"; }
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

  // ── More Menu ──────────────────────────────────
  window.toggleMoreMenu = function () {
    var menu = $("#more-menu");
    menu.classList.toggle("hidden");
  };
  window.closeMoreMenu = function () {
    $("#more-menu").classList.add("hidden");
  };
  // Close menu on outside click
  document.addEventListener("click", function (e) {
    var menu = $("#more-menu");
    var btn = $("#btn-more");
    if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });

  // ── Cron Panel ────────────────────────────────
  window.openCron = function () {
    $("#cron-panel").classList.remove("hidden");
    refreshCron();
  };
  window.closeCron = function () {
    $("#cron-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };
  window.refreshCron = async function () {
    var body = $("#cron-body");
    body.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/cron?action=list");
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      if (!data.crons || data.crons.length === 0) {
        body.innerHTML = '<div class="file-empty">예약 작업 없음</div>';
        return;
      }
      var html = '<div class="cron-list">';
      data.crons.forEach(function (c) {
        if (c.comment) {
          html += '<div class="cron-item comment">';
          html += '<span class="cron-line">' + escHtml(c.line) + '</span>';
          html += '</div>';
        } else {
          var parts = c.line.trim().split(/\s+/);
          var schedule = parts.slice(0, 5).join(" ");
          var cmd = parts.slice(5).join(" ");
          html += '<div class="cron-item">';
          html += '<div class="cron-schedule">' + escHtml(schedule) + '</div>';
          html += '<div class="cron-cmd">' + escHtml(cmd) + '</div>';
          html += '<button class="cron-del-btn" onclick="deleteCron(' + c.index + ')">';
          html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
          html += '</button>';
          html += '</div>';
        }
      });
      html += '</div>';
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  };
  window.addCronJob = function () {
    var schedule = prompt("스케줄 (예: */5 * * * *):");
    if (!schedule) return;
    var cmd = prompt("명령어:");
    if (!cmd) return;
    var entry = schedule.trim() + " " + cmd.trim();
    fetch("/api/cron?action=add&entry=" + encodeURIComponent(entry))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("추가 완료"); refreshCron(); }
        else showToast(data.error || "추가 실패", true);
      })
      .catch(function (e) { showToast("오류: " + e.message, true); });
  };
  window.deleteCron = function (idx) {
    if (!confirm("이 예약 작업을 삭제하시겠습니까?")) return;
    fetch("/api/cron?action=delete&index=" + idx)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("삭제 완료"); refreshCron(); }
        else showToast(data.error || "삭제 실패", true);
      })
      .catch(function (e) { showToast("오류: " + e.message, true); });
  };

  // ── Disk Usage Panel ──────────────────────────
  var diskCurrentPath = "";
  window.openDisk = function () {
    $("#disk-panel").classList.remove("hidden");
    diskCurrentPath = userHome || "";
    fetchDisk(diskCurrentPath);
  };
  window.closeDisk = function () {
    $("#disk-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };
  window.refreshDisk = function () {
    fetchDisk(diskCurrentPath);
  };
  window.fetchDisk = async function fetchDisk(path) {
    var body = $("#disk-body");
    body.innerHTML = '<div class="file-loading">분석 중... (시간이 걸릴 수 있습니다)</div>';
    try {
      var res = await fetch("/api/diskusage?path=" + encodeURIComponent(path));
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      diskCurrentPath = data.path;
      var html = '<div class="disk-path">' + escHtml(data.path) + '</div>';
      if (data.path && data.path !== "/") {
        html += '<button class="disk-parent-btn" onclick="fetchDisk(\'' + escHtml(data.path.replace(/\/[^/]+\/?$/, "") || "/").replace(/'/g, "\\'") + '\')">.. 상위 디렉토리</button>';
      }
      html += '<div class="disk-list">';
      var maxSize = 0;
      var parsedEntries = data.entries.map(function (e) {
        var bytes = parseDiskSize(e.size);
        if (bytes > maxSize) maxSize = bytes;
        return { size: e.size, path: e.path, bytes: bytes };
      });
      parsedEntries.forEach(function (e) {
        var pct = maxSize > 0 ? (e.bytes / maxSize * 100) : 0;
        var name = e.path.split("/").pop() || e.path;
        var isDir = true;
        html += '<div class="disk-item" onclick="fetchDisk(\'' + escHtml(e.path).replace(/'/g, "\\'") + '\')">';
        html += '<div class="disk-item-top"><span class="disk-item-name">' + escHtml(name) + '</span><span class="disk-item-size">' + escHtml(e.size) + '</span></div>';
        html += '<div class="stat-bar-wrap"><div class="stat-bar ' + (pct > 80 ? "danger" : pct > 50 ? "warn" : "") + '" style="width:' + pct + '%"></div></div>';
        html += '</div>';
      });
      html += '</div>';
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">분석 실패</div>';
    }
  }
  function parseDiskSize(s) {
    s = s.trim();
    try {
      if (s.endsWith("G")) return parseFloat(s) * 1073741824;
      if (s.endsWith("M")) return parseFloat(s) * 1048576;
      if (s.endsWith("K")) return parseFloat(s) * 1024;
      if (s.endsWith("T")) return parseFloat(s) * 1099511627776;
      return parseFloat(s) || 0;
    } catch (e) { return 0; }
  }

  // ── Network Panel ─────────────────────────────
  window.openNet = function () {
    $("#net-panel").classList.remove("hidden");
    refreshNet();
  };
  window.closeNet = function () {
    $("#net-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };
  window.refreshNet = async function () {
    var body = $("#net-body");
    body.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/netstat");
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      var html = '';
      // Listeners
      if (data.listeners && data.listeners.length > 0) {
        html += '<div class="net-section-title">열린 포트 (LISTEN)</div>';
        html += '<div class="net-list">';
        data.listeners.forEach(function (l) {
          html += '<div class="net-item listen">';
          html += '<span class="net-proto">' + escHtml(l.proto) + '</span>';
          html += '<span class="net-addr">' + escHtml(l.local) + '</span>';
          html += '<span class="net-proc">' + escHtml(l.process || "") + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      // Active connections
      if (data.connections && data.connections.length > 0) {
        html += '<div class="net-section-title">활성 연결</div>';
        html += '<div class="net-list">';
        data.connections.forEach(function (c) {
          var stateClass = c.state === "ESTAB" ? "estab" : c.state === "LISTEN" ? "listen" : "";
          html += '<div class="net-item ' + stateClass + '">';
          html += '<span class="net-proto">' + escHtml(c.proto) + '</span>';
          html += '<span class="net-state">' + escHtml(c.state) + '</span>';
          html += '<span class="net-addr">' + escHtml(c.local) + '</span>';
          html += '<span class="net-peer">' + escHtml(c.peer) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      if (!html) html = '<div class="file-empty">연결 없음</div>';
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  };

  // ── Services Panel ────────────────────────────
  var allServices = [];
  window.openServices = function () {
    $("#services-panel").classList.remove("hidden");
    refreshServices();
  };
  window.closeServices = function () {
    $("#services-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };
  window.refreshServices = async function () {
    var body = $("#services-body");
    body.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/services?action=list");
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      allServices = data.services || [];
      renderServices(allServices);
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  };
  window.filterServices = function () {
    var q = ($("#svc-search") || {}).value || "";
    q = q.toLowerCase();
    var filtered = allServices.filter(function (s) {
      return s.name.toLowerCase().indexOf(q) >= 0 || (s.description || "").toLowerCase().indexOf(q) >= 0;
    });
    renderServices(filtered);
  };
  function renderServices(services) {
    var body = $("#services-body");
    if (!services || services.length === 0) {
      body.innerHTML = '<div class="file-empty">서비스 없음</div>';
      return;
    }
    var html = '<div class="svc-list">';
    services.forEach(function (s) {
      var stateClass = s.active === "active" ? "running" : s.active === "failed" ? "failed" : "inactive";
      html += '<div class="svc-item">';
      html += '<div class="svc-top">';
      html += '<span class="docker-status-badge ' + (stateClass === "running" ? "running" : stateClass === "failed" ? "exited" : "other") + '"></span>';
      html += '<span class="svc-name">' + escHtml(s.name) + '</span>';
      html += '<span class="svc-sub">' + escHtml(s.sub) + '</span>';
      html += '</div>';
      if (s.description) html += '<div class="svc-desc">' + escHtml(s.description) + '</div>';
      html += '<div class="docker-actions">';
      if (s.active !== "active") {
        html += '<button class="docker-action-btn start" onclick="svcAction(\'start\',\'' + escHtml(s.name) + '\')">시작</button>';
      } else {
        html += '<button class="docker-action-btn stop" onclick="svcAction(\'stop\',\'' + escHtml(s.name) + '\')">중지</button>';
      }
      html += '<button class="docker-action-btn restart" onclick="svcAction(\'restart\',\'' + escHtml(s.name) + '\')">재시작</button>';
      html += '<button class="docker-action-btn logs" onclick="svcStatus(\'' + escHtml(s.name) + '\')">상태</button>';
      html += '</div>';
      html += '<div id="svc-status-' + escHtml(s.name) + '" class="svc-status-output"></div>';
      html += '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }
  window.svcAction = async function (action, name) {
    showToast(action + " 요청 중...");
    try {
      var res = await fetch("/api/services?action=" + action + "&name=" + encodeURIComponent(name));
      var data = await res.json();
      if (data.ok) {
        showToast("완료: " + action);
        setTimeout(refreshServices, 1000);
      } else {
        showToast(data.error || "실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };
  window.svcStatus = async function (name) {
    var el = document.getElementById("svc-status-" + name);
    if (!el) return;
    if (el.innerHTML) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="docker-logs-view">불러오는 중...</div>';
    try {
      var res = await fetch("/api/services?action=status&name=" + encodeURIComponent(name));
      var data = await res.json();
      el.innerHTML = '<div class="docker-logs-view">' + escHtml(data.output || data.error || "정보 없음") + '</div>';
    } catch (e) {
      el.innerHTML = '<div class="docker-logs-view">불러오기 실패</div>';
    }
  };

  // ── File Upload ───────────────────────────────
  window.openUpload = function () {
    var input = document.createElement("input");
    input.type = "file";
    input.onchange = function () {
      var file = input.files[0];
      if (!file) return;
      if (file.size > 10 * 1048576) {
        showToast("파일 크기 제한: 최대 10MB", true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = reader.result.split(",")[1];
        var targetDir = currentDir || userHome || "";
        showToast(file.name + " 업로드 중...");
        fetch("/api/upload?path=" + encodeURIComponent(targetDir) + "&name=" + encodeURIComponent(file.name) + "&b64=" + encodeURIComponent(b64))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok) {
              showToast("업로드 완료: " + file.name + " (" + fmtSize(data.size) + ")");
              if (currentDir) loadTree(currentDir);
            } else {
              showToast(data.error || "업로드 실패", true);
            }
          })
          .catch(function (e) { showToast("업로드 실패: " + e.message, true); });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ── File Download (called from file viewer or sidebar) ─
  window.downloadFile = function (path) {
    if (!path) return;
    window.open("/api/download?path=" + encodeURIComponent(path), "_blank");
  };

  // ── Bookmarks ─────────────────────────────────
  window.openBookmarks = function () {
    var panel = document.createElement("div");
    panel.id = "bookmark-popup";
    panel.className = "popup-overlay";
    panel.innerHTML = '<div class="popup-card"><div class="pp-title">즐겨찾기</div><div id="bookmark-list"><div class="file-loading">불러오는 중...</div></div><div class="bookmark-actions"><button onclick="addBookmark()">현재 경로 추가</button><button onclick="closeBookmarkPopup()">닫기</button></div></div>';
    document.body.appendChild(panel);
    fetchBookmarks();
  };
  window.closeBookmarkPopup = function () {
    var popup = document.getElementById("bookmark-popup");
    if (popup) popup.remove();
  };
  async function fetchBookmarks() {
    var el = document.getElementById("bookmark-list");
    if (!el) return;
    try {
      var res = await fetch("/api/bookmarks?action=list");
      var data = await res.json();
      if (!data.bookmarks || data.bookmarks.length === 0) {
        el.innerHTML = '<div class="file-empty" style="padding:16px">즐겨찾기 없음</div>';
        return;
      }
      var html = "";
      data.bookmarks.forEach(function (b, i) {
        html += '<div class="bookmark-item">';
        html += '<span class="bookmark-name" onclick="goToBookmark(\'' + escHtml(b.path).replace(/'/g, "\\'") + '\')">' + escHtml(b.name) + '</span>';
        html += '<span class="bookmark-path">' + escHtml(b.path) + '</span>';
        html += '<button class="bookmark-del" onclick="removeBookmark(' + i + ')">X</button>';
        html += '</div>';
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }
  window.addBookmark = function () {
    var path = currentDir || userHome;
    if (!path) { showToast("경로를 먼저 열어주세요", true); return; }
    var name = prompt("즐겨찾기 이름:", path.split("/").pop() || path);
    if (!name) return;
    fetch("/api/bookmarks?action=add&path=" + encodeURIComponent(path) + "&name=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("추가 완료"); fetchBookmarks(); }
        else showToast(data.error || "추가 실패", true);
      });
  };
  window.removeBookmark = function (idx) {
    fetch("/api/bookmarks?action=remove&index=" + idx)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("삭제 완료"); fetchBookmarks(); }
        else showToast(data.error || "삭제 실패", true);
      });
  };
  window.goToBookmark = function (path) {
    closeBookmarkPopup();
    toggleSidebar();
    setTimeout(function () { loadTree(path); }, 200);
  };

  // ── Server Alerts (threshold warnings in monitor) ─
  var alertThresholds = { cpu: 85, memory: 85, disk: 90 };
  var lastAlertTime = {};

  function checkAlerts(s) {
    var now = Date.now();
    var cpuPct = Math.min(s.cpu.percent, 100);
    if (cpuPct >= alertThresholds.cpu && (!lastAlertTime.cpu || now - lastAlertTime.cpu > 60000)) {
      showToast("CPU 경고: " + cpuPct + "% 사용 중", true);
      lastAlertTime.cpu = now;
    }
    if (s.memory.percent >= alertThresholds.memory && (!lastAlertTime.memory || now - lastAlertTime.memory > 60000)) {
      showToast("메모리 경고: " + s.memory.percent + "% 사용 중", true);
      lastAlertTime.memory = now;
    }
    if (s.disk.percent >= alertThresholds.disk && (!lastAlertTime.disk || now - lastAlertTime.disk > 60000)) {
      showToast("디스크 경고: " + s.disk.percent + "% 사용 중", true);
      lastAlertTime.disk = now;
    }
  }

  // ── SSH Servers Panel ──────────────────────────
  window.openServers = function () {
    $("#servers-panel").classList.remove("hidden");
    refreshServers();
  };
  window.closeServers = function () {
    $("#servers-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };
  window.refreshServers = async function () {
    var body = $("#servers-body");
    body.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/ssh-servers?action=list");
      var data = await res.json();
      if (data.error) {
        body.innerHTML = '<div class="file-empty">' + escHtml(data.error) + '</div>';
        return;
      }
      if (!data.servers || data.servers.length === 0) {
        body.innerHTML = '<div class="file-empty">저장된 서버 없음<br><br>상단 + 버튼으로 서버를 추가하세요</div>';
        return;
      }
      var html = "";
      data.servers.forEach(function (s) {
        html += '<div class="server-card">';
        html += '<div class="server-card-top">';
        html += '<div class="server-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg></div>';
        html += '<span class="server-name">' + escHtml(s.name) + '</span>';
        html += '</div>';
        html += '<div class="server-detail">' + escHtml(s.username) + '@' + escHtml(s.host) + ':' + s.port + '</div>';
        if (s.jump_host) {
          html += '<span class="server-jump-badge">via ' + escHtml(s.jump_host) + '</span>';
        }
        html += '<div class="server-actions">';
        html += '<button class="server-action-btn connect" onclick="connectServer(\'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">접속</button>';
        html += '<button class="server-action-btn edit" onclick="editServer(\'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">편집</button>';
        html += '<button class="server-action-btn delete" onclick="deleteServer(\'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">삭제</button>';
        html += '</div>';
        html += '</div>';
      });
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  };

  window.connectServer = async function (name) {
    try {
      var res = await fetch("/api/ssh-servers?action=connect&name=" + encodeURIComponent(name));
      var data = await res.json();
      if (data.error) {
        showToast(data.error, true);
        return;
      }
      // Close servers panel and send SSH command to terminal
      closeServers();
      var cmd = data.command + "\n";
      sendWs(cmd);
      showToast(name + " 접속 중...");
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  window.addServer = function () {
    // Clear form
    $("#sf-original-name").value = "";
    $("#sf-name").value = "";
    $("#sf-host").value = "";
    $("#sf-port").value = "22";
    $("#sf-username").value = "";
    $("#sf-auth").value = "key";
    $("#sf-keypath").value = "";
    $("#sf-jumphost").value = "";
    $("#server-form-title").textContent = "서버 추가";
    $("#server-form").classList.remove("hidden");
  };

  window.editServer = async function (name) {
    try {
      var res = await fetch("/api/ssh-servers?action=list");
      var data = await res.json();
      var server = (data.servers || []).find(function (s) { return s.name === name; });
      if (!server) {
        showToast("서버를 찾을 수 없습니다", true);
        return;
      }
      $("#sf-original-name").value = server.name;
      $("#sf-name").value = server.name;
      $("#sf-host").value = server.host;
      $("#sf-port").value = server.port || 22;
      $("#sf-username").value = server.username;
      $("#sf-auth").value = server.auth || "key";
      $("#sf-keypath").value = server.key_path || "";
      $("#sf-jumphost").value = server.jump_host || "";
      $("#server-form-title").textContent = "서버 편집";
      $("#server-form").classList.remove("hidden");
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  window.closeServerForm = function () {
    $("#server-form").classList.add("hidden");
  };

  window.saveServerForm = async function () {
    var name = ($("#sf-name").value || "").trim();
    var host = ($("#sf-host").value || "").trim();
    var port = $("#sf-port").value || "22";
    var username = ($("#sf-username").value || "").trim();
    var auth = $("#sf-auth").value || "key";
    var keyPath = ($("#sf-keypath").value || "").trim();
    var jumpHost = ($("#sf-jumphost").value || "").trim();
    var originalName = ($("#sf-original-name").value || "").trim();

    if (!name || !host || !username) {
      showToast("이름, 호스트, 사용자는 필수입니다", true);
      return;
    }

    // If name changed during edit, delete the old one first
    if (originalName && originalName !== name) {
      try {
        await fetch("/api/ssh-servers?action=delete&name=" + encodeURIComponent(originalName));
      } catch (e) { /* ignore */ }
    }

    var url = "/api/ssh-servers?action=save" +
      "&name=" + encodeURIComponent(name) +
      "&host=" + encodeURIComponent(host) +
      "&port=" + encodeURIComponent(port) +
      "&username=" + encodeURIComponent(username) +
      "&auth=" + encodeURIComponent(auth) +
      "&key_path=" + encodeURIComponent(keyPath) +
      "&jump_host=" + encodeURIComponent(jumpHost);

    try {
      var res = await fetch(url);
      var data = await res.json();
      if (data.ok) {
        showToast("저장 완료");
        closeServerForm();
        refreshServers();
      } else {
        showToast(data.error || "저장 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  window.deleteServer = async function (name) {
    if (!confirm("'" + name + "' 서버를 삭제하시겠습니까?")) return;
    try {
      var res = await fetch("/api/ssh-servers?action=delete&name=" + encodeURIComponent(name));
      var data = await res.json();
      if (data.ok) {
        showToast("삭제 완료");
        refreshServers();
      } else {
        showToast(data.error || "삭제 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  // ── Override renderMonitor to use tabs ─────────
  // Replace the original renderMonitor with the tabbed version
  renderMonitor = function (s) {
    checkAlerts(s);
    renderMonitorWithTabs(s);
  };

  // ══════════════════════════════════════════════════
  // Feature 1: Training Monitor Dashboard
  // ══════════════════════════════════════════════════
  var trainingTimer = null;
  var trainingLogPath = "";
  var trainingAutoScroll = true;
  var trainingLogWatchTimer = null;

  window.openTraining = function () {
    $("#training-panel").classList.remove("hidden");
    refreshTraining();
    trainingTimer = setInterval(refreshTrainingGpu, 5000);
  };

  window.closeTraining = function () {
    $("#training-panel").classList.add("hidden");
    if (trainingTimer) { clearInterval(trainingTimer); trainingTimer = null; }
    if (trainingLogWatchTimer) { clearInterval(trainingLogWatchTimer); trainingLogWatchTimer = null; }
    setTimeout(doFit, 50);
  };

  window.refreshTraining = function () {
    refreshTrainingGpu();
  };

  async function refreshTrainingGpu() {
    try {
      var res = await fetch("/api/training?action=status");
      var data = await res.json();
      renderTrainingPanel(data);
    } catch (e) {
      var body = $("#training-body");
      if (body) body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  function renderTrainingPanel(data) {
    var body = $("#training-body");
    if (!body) return;
    var html = "";

    // GPU utilization chart
    if (data.gpus && data.gpus.length > 0) {
      html += '<div class="gpu-chart-wrap">';
      html += '<div class="gpu-chart-title">GPU Utilization (최근 5분)</div>';
      html += '<div class="gpu-chart-bars" id="gpu-util-chart">';
      // Use GPU 0's history for the main chart
      var hist = data.gpus[0].util_history || [];
      for (var i = 0; i < hist.length; i++) {
        var val = hist[i];
        var color = val < 60 ? "green" : val < 85 ? "orange" : "red";
        html += '<div class="gpu-chart-bar ' + color + '" style="height:' + Math.max(val, 1) + '%"></div>';
      }
      // Pad to 60
      for (var j = hist.length; j < 60; j++) {
        html += '<div class="gpu-chart-bar green" style="height:1%"></div>';
      }
      html += '</div></div>';

      // Live GPU cards
      html += '<div class="gpu-live-row">';
      data.gpus.forEach(function (gpu, idx) {
        var vramPct = gpu.memory_total > 0 ? Math.round(gpu.memory_used / gpu.memory_total * 100) : 0;
        var utilColor = gpu.util < 60 ? "var(--green)" : gpu.util < 85 ? "var(--orange)" : "var(--red)";
        html += '<div class="gpu-live-card">';
        html += '<div class="gpu-live-name">GPU ' + idx + ': ' + escHtml(gpu.name) + '</div>';
        html += '<div class="gpu-live-stats">';
        html += '<span style="color:' + utilColor + '">' + gpu.util + '%</span> ';
        html += (gpu.memory_used / 1024).toFixed(1) + '/' + (gpu.memory_total / 1024).toFixed(1) + 'GB ';
        html += gpu.temp + '\u00B0C';
        if (gpu.power && gpu.power !== "0") html += ' ' + parseFloat(gpu.power).toFixed(0) + 'W';
        html += '</div>';
        html += '<div class="stat-bar-wrap" style="margin-top:4px"><div class="stat-bar ' + barClass(gpu.util) + '" style="width:' + gpu.util + '%"></div></div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="stat-card"><div class="stat-label">GPU</div><div class="stat-value" style="color:var(--text3)">GPU not detected</div></div>';
    }

    // Training log section (persists path)
    html += '<div class="training-log-section">';
    html += '<div class="gpu-chart-title">Training Log</div>';
    html += '<div class="training-log-header">';
    html += '<input type="text" id="training-log-path" placeholder="로그 파일 경로 입력..." value="' + escHtml(trainingLogPath) + '">';
    html += '<button class="docker-action-btn logs" onclick="loadTrainingLog()" style="min-height:40px">불러오기</button>';
    html += '</div>';
    html += '<div class="training-log-content" id="training-log-content">로그 파일 경로를 입력하고 불러오기를 눌러주세요.</div>';
    html += '<div class="training-log-controls">';
    html += '<label><input type="checkbox" id="training-autoscroll" ' + (trainingAutoScroll ? "checked" : "") + ' onchange="trainingAutoScroll=this.checked"> 자동 스크롤</label>';
    html += '<label><input type="checkbox" id="training-autorefresh" onchange="toggleTrainingLogWatch(this.checked)"> 자동 갱신 (3초)</label>';
    html += '</div>';
    html += '</div>';

    body.innerHTML = html;

    // Scroll chart to right
    var chart = document.getElementById("gpu-util-chart");
    if (chart) chart.scrollLeft = chart.scrollWidth;

    // If we had a log loaded, reload it
    if (trainingLogPath) {
      setTimeout(loadTrainingLog, 100);
    }
  }

  window.loadTrainingLog = async function () {
    var pathInput = document.getElementById("training-log-path");
    if (!pathInput) return;
    var logPath = pathInput.value.trim();
    if (!logPath) return;
    trainingLogPath = logPath;
    var el = document.getElementById("training-log-content");
    if (!el) return;
    el.textContent = "불러오는 중...";
    try {
      var res = await fetch("/api/training?action=watch&path=" + encodeURIComponent(logPath));
      var data = await res.json();
      if (data.error) {
        el.textContent = data.error;
        return;
      }
      el.textContent = data.content || "(empty)";
      if (trainingAutoScroll) el.scrollTop = el.scrollHeight;
    } catch (e) {
      el.textContent = "불러오기 실패: " + e.message;
    }
  };

  window.toggleTrainingLogWatch = function (enabled) {
    if (trainingLogWatchTimer) {
      clearInterval(trainingLogWatchTimer);
      trainingLogWatchTimer = null;
    }
    if (enabled && trainingLogPath) {
      trainingLogWatchTimer = setInterval(loadTrainingLog, 3000);
    }
  };

  // ══════════════════════════════════════════════════
  // Feature 2: Alert System
  // ══════════════════════════════════════════════════
  var alertPollTimer = null;
  var alertBadgeCount = 0;

  function startAlertPolling() {
    alertPollTimer = setInterval(pollPendingAlerts, 10000);
  }

  async function pollPendingAlerts() {
    try {
      var res = await fetch("/api/alerts?action=pending");
      var data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(function (a) {
          showToast(a.message, a.level === "warning");
        });
        alertBadgeCount += data.alerts.length;
        updateAlertBadge();
      }
    } catch (e) { /* ignore */ }
  }

  function updateAlertBadge() {
    var badge = document.getElementById("alert-badge");
    if (!badge) return;
    if (alertBadgeCount > 0) {
      badge.textContent = alertBadgeCount > 99 ? "99+" : alertBadgeCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  window.openAlertConfig = function () {
    alertBadgeCount = 0;
    updateAlertBadge();
    $("#alert-panel").classList.remove("hidden");
    loadAlertConfig();
  };

  window.closeAlertConfig = function () {
    $("#alert-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };

  async function loadAlertConfig() {
    var body = $("#alert-body");
    body.innerHTML = '<div class="file-loading">불러오는 중...</div>';
    try {
      var res = await fetch("/api/alerts?action=config");
      var cfgData = await res.json();
      var cfg = cfgData.config || {};
      var th = cfg.thresholds || {};

      var res2 = await fetch("/api/alerts?action=history");
      var histData = await res2.json();
      var history = histData.alerts || [];

      var html = '';
      // Thresholds
      html += '<div class="alert-section">';
      html += '<div class="alert-section-title">임계값 설정</div>';
      var thresholds = [
        { key: "cpu", label: "CPU", val: th.cpu || 90 },
        { key: "memory", label: "Memory", val: th.memory || 90 },
        { key: "disk", label: "Disk", val: th.disk || 95 },
        { key: "gpu_util", label: "GPU Util", val: th.gpu_util || 95 },
        { key: "gpu_temp", label: "GPU Temp", val: th.gpu_temp || 85 },
      ];
      thresholds.forEach(function (t) {
        html += '<div class="alert-threshold-row">';
        html += '<span class="alert-threshold-label">' + t.label + '</span>';
        html += '<input type="range" class="alert-threshold-slider" id="alert-th-' + t.key + '" min="50" max="100" value="' + t.val + '" oninput="document.getElementById(\'alert-thv-' + t.key + '\').textContent=this.value+\'%\'">';
        html += '<span class="alert-threshold-value" id="alert-thv-' + t.key + '">' + t.val + '%</span>';
        html += '</div>';
      });
      html += '<div class="alert-actions">';
      html += '<button class="primary" onclick="saveAlertThresholds()">저장</button>';
      html += '</div>';
      html += '</div>';

      // Telegram
      html += '<div class="alert-section">';
      html += '<div class="alert-section-title">Telegram 알림</div>';
      html += '<div class="alert-input-row"><label>Bot Token</label>';
      html += '<input type="text" id="alert-tg-token" value="' + escHtml(cfg.telegram_bot_token || "") + '" placeholder="123456:ABC-DEF..." autocomplete="off"></div>';
      html += '<div class="alert-input-row"><label>Chat ID</label>';
      html += '<input type="text" id="alert-tg-chatid" value="' + escHtml(cfg.telegram_chat_id || "") + '" placeholder="-1001234567890" autocomplete="off"></div>';
      html += '<div class="alert-actions">';
      html += '<button class="primary" onclick="saveAlertTelegram()">저장</button>';
      html += '<button onclick="testAlert()">테스트 전송</button>';
      html += '</div>';
      html += '</div>';

      // History
      html += '<div class="alert-section">';
      html += '<div class="alert-section-title">알림 기록</div>';
      if (history.length === 0) {
        html += '<div style="color:var(--text3);font-size:13px">기록 없음</div>';
      } else {
        html += '<div class="alert-history-list">';
        history.slice().reverse().forEach(function (a) {
          var d = new Date(a.timestamp * 1000);
          var timeStr = d.toLocaleString("ko-KR", { hour12: false });
          html += '<div class="alert-history-item">';
          html += '<div class="alert-history-time">' + escHtml(timeStr) + '</div>';
          html += '<div class="alert-history-msg ' + (a.level === "info" ? "info" : "") + '">' + escHtml(a.message) + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';

      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  window.saveAlertThresholds = async function () {
    var keys = ["cpu", "memory", "disk", "gpu_util", "gpu_temp"];
    var url = "/api/alerts?action=set";
    keys.forEach(function (k) {
      var el = document.getElementById("alert-th-" + k);
      if (el) url += "&" + k + "=" + el.value;
    });
    try {
      var res = await fetch(url);
      var data = await res.json();
      if (data.ok) showToast("임계값 저장 완료");
      else showToast(data.error || "저장 실패", true);
    } catch (e) { showToast("오류: " + e.message, true); }
  };

  window.saveAlertTelegram = async function () {
    var token = (document.getElementById("alert-tg-token") || {}).value || "";
    var chatId = (document.getElementById("alert-tg-chatid") || {}).value || "";
    var url = "/api/alerts?action=set&telegram_bot_token=" + encodeURIComponent(token) + "&telegram_chat_id=" + encodeURIComponent(chatId);
    try {
      var res = await fetch(url);
      var data = await res.json();
      if (data.ok) showToast("Telegram 설정 저장 완료");
      else showToast(data.error || "저장 실패", true);
    } catch (e) { showToast("오류: " + e.message, true); }
  };

  window.testAlert = async function () {
    try {
      var res = await fetch("/api/alerts?action=test");
      var data = await res.json();
      if (data.ok) {
        showToast("테스트 알림 전송됨" + (data.telegram ? " (" + data.telegram + ")" : ""));
      } else {
        showToast("테스트 실패", true);
      }
    } catch (e) { showToast("오류: " + e.message, true); }
  };

  // ══════════════════════════════════════════════════
  // Feature 3: File Transfer (Server-to-Server)
  // ══════════════════════════════════════════════════
  var transferAction = "copy";
  var transferSrc = "";

  window.openTransferPopup = function (action, src) {
    transferAction = action;
    transferSrc = src;
    document.getElementById("transfer-title").textContent = (action === "copy" ? "복사" : "이동") + " 대상 선택";
    document.getElementById("transfer-dst").value = "";
    // Load servers for remote option
    fetch("/api/ssh-servers?action=list")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var select = document.getElementById("transfer-server");
        select.innerHTML = '<option value="">로컬</option>';
        if (data.servers) {
          data.servers.forEach(function (s) {
            select.innerHTML += '<option value="' + escHtml(s.name) + '">' + escHtml(s.name) + ' (' + escHtml(s.host) + ')</option>';
          });
        }
      })
      .catch(function () {});
    document.getElementById("transfer-popup").classList.remove("hidden");
  };

  window.closeTransferPopup = function () {
    document.getElementById("transfer-popup").classList.add("hidden");
  };

  window.executeTransfer = async function () {
    var dst = (document.getElementById("transfer-dst") || {}).value || "";
    var server = (document.getElementById("transfer-server") || {}).value || "";
    if (!dst) { showToast("대상 경로를 입력하세요", true); return; }
    var url = "/api/transfer?action=" + transferAction + "&src=" + encodeURIComponent(transferSrc) + "&dst=" + encodeURIComponent(dst);
    if (server) url += "&server=" + encodeURIComponent(server);
    try {
      showToast("전송 시작...");
      var res = await fetch(url);
      var data = await res.json();
      if (data.ok) {
        showToast("전송 " + (data.transfer_id ? "시작됨 (ID: " + data.transfer_id + ")" : "완료"));
        closeTransferPopup();
      } else {
        showToast(data.error || "전송 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  // Add context menu to file items (long press)
  var contextMenuTimeout = null;
  var contextMenuEl = null;

  function addFileContextMenu(div, entry) {
    var touchStart = null;
    div.addEventListener("touchstart", function (e) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      contextMenuTimeout = setTimeout(function () {
        showFileContextMenu(touchStart.x, touchStart.y, entry);
      }, 600);
    }, { passive: true });
    div.addEventListener("touchmove", function () {
      if (contextMenuTimeout) { clearTimeout(contextMenuTimeout); contextMenuTimeout = null; }
    }, { passive: true });
    div.addEventListener("touchend", function () {
      if (contextMenuTimeout) { clearTimeout(contextMenuTimeout); contextMenuTimeout = null; }
    }, { passive: true });
  }

  function showFileContextMenu(x, y, entry) {
    closeFileContextMenu();
    var menu = document.createElement("div");
    menu.className = "file-context-menu";
    menu.style.left = Math.min(x, window.innerWidth - 180) + "px";
    menu.style.top = Math.min(y, window.innerHeight - 160) + "px";

    var copyBtn = document.createElement("button");
    copyBtn.textContent = "복사...";
    copyBtn.onclick = function () { closeFileContextMenu(); openTransferPopup("copy", entry.path); };
    menu.appendChild(copyBtn);

    var moveBtn = document.createElement("button");
    moveBtn.textContent = "이동...";
    moveBtn.onclick = function () { closeFileContextMenu(); openTransferPopup("move", entry.path); };
    menu.appendChild(moveBtn);

    if (!entry.is_dir) {
      var dlBtn = document.createElement("button");
      dlBtn.textContent = "다운로드";
      dlBtn.onclick = function () { closeFileContextMenu(); downloadFile(entry.path); };
      menu.appendChild(dlBtn);
    }

    document.body.appendChild(menu);
    contextMenuEl = menu;

    setTimeout(function () {
      document.addEventListener("click", closeFileContextMenu, { once: true });
    }, 100);
  }

  function closeFileContextMenu() {
    if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
  }

  // Patch renderFileList to add context menu
  var _origRenderFileList = renderFileList;
  renderFileList = function (data) {
    _origRenderFileList(data);
    var items = $$("#file-list .fitem");
    items.forEach(function (div, idx) {
      if (idx < data.entries.length) {
        addFileContextMenu(div, data.entries[idx]);
      }
    });
  };

  // ══════════════════════════════════════════════════
  // Feature 4: Terminal Session Sharing
  // ══════════════════════════════════════════════════
  var shareActive = false;

  window.toggleShare = function () {
    document.getElementById("share-popup").classList.remove("hidden");
    refreshShareStatus();
  };

  window.closeSharePopup = function () {
    document.getElementById("share-popup").classList.add("hidden");
  };

  async function refreshShareStatus() {
    try {
      var res = await fetch("/api/share?action=status");
      var data = await res.json();
      shareActive = data.active;
      var statusText = document.getElementById("share-status-text");
      var urlInput = document.getElementById("share-url-input");
      var toggleBtn = document.getElementById("share-toggle-btn");
      var shareBtn = document.getElementById("btn-share");

      if (data.active && data.token) {
        var shareUrl = location.origin + "?share=" + data.token;
        statusText.textContent = "공유 활성 중 (뷰어: " + (data.viewers || 0) + "명)";
        statusText.style.color = "var(--green)";
        urlInput.value = shareUrl;
        urlInput.style.display = "";
        toggleBtn.textContent = "공유 중지";
        toggleBtn.className = "sf-cancel-btn";
        if (shareBtn) shareBtn.classList.add("sharing");
      } else {
        statusText.textContent = "공유가 비활성 상태입니다. 시작하면 읽기 전용 URL이 생성됩니다.";
        statusText.style.color = "var(--text2)";
        urlInput.style.display = "none";
        toggleBtn.textContent = "공유 시작";
        toggleBtn.className = "sf-save-btn";
        if (shareBtn) shareBtn.classList.remove("sharing");
      }
    } catch (e) {
      showToast("공유 상태 확인 실패", true);
    }
  }

  window.toggleShareState = async function () {
    var action = shareActive ? "stop" : "start";
    try {
      var res = await fetch("/api/share?action=" + action);
      var data = await res.json();
      if (data.ok) {
        showToast(action === "start" ? "공유 시작됨" : "공유 중지됨");
        refreshShareStatus();
      } else {
        showToast("공유 설정 실패", true);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  // ══════════════════════════════════════════════════
  // Feature 5: Command Snippet Library
  // ══════════════════════════════════════════════════
  var allSnippets = [];
  var snippetCategory = "all";

  window.openSnippets = function () {
    $("#snippets-panel").classList.remove("hidden");
    fetchSnippets();
  };

  window.closeSnippets = function () {
    $("#snippets-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };

  async function fetchSnippets() {
    try {
      var res = await fetch("/api/snippets?action=list");
      var data = await res.json();
      allSnippets = data.snippets || [];
      renderSnippetTabs();
      renderSnippets();
    } catch (e) {
      $("#snippets-body").innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  function renderSnippetTabs() {
    var tabs = document.getElementById("snippet-tabs");
    if (!tabs) return;
    var categories = ["all"];
    var catSet = {};
    allSnippets.forEach(function (s) {
      if (s.category && !catSet[s.category]) {
        catSet[s.category] = true;
        categories.push(s.category);
      }
    });
    var labels = { all: "전체", system: "System", git: "Git", docker: "Docker", ml: "ML", claude: "Claude", custom: "Custom" };
    var html = "";
    categories.forEach(function (cat) {
      html += '<button class="snippet-tab ' + (snippetCategory === cat ? "active" : "") + '" onclick="switchSnippetCategory(\'' + cat + '\')">' + (labels[cat] || cat) + '</button>';
    });
    tabs.innerHTML = html;
  }

  window.switchSnippetCategory = function (cat) {
    snippetCategory = cat;
    renderSnippetTabs();
    renderSnippets();
  };

  window.filterSnippets = function () {
    renderSnippets();
  };

  function renderSnippets() {
    var body = $("#snippets-body");
    var searchQ = ((document.getElementById("snippet-search") || {}).value || "").toLowerCase();
    var filtered = allSnippets.filter(function (s) {
      var matchCat = snippetCategory === "all" || s.category === snippetCategory;
      var matchSearch = !searchQ || s.name.toLowerCase().indexOf(searchQ) >= 0 || s.command.toLowerCase().indexOf(searchQ) >= 0 || (s.description || "").toLowerCase().indexOf(searchQ) >= 0;
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      body.innerHTML = '<div class="file-empty">스니펫 없음</div>';
      return;
    }

    var html = '<div class="snippet-list">';
    filtered.forEach(function (s) {
      html += '<div class="snippet-item" onclick="runSnippet(\'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">';
      html += '<div class="snippet-item-top">';
      html += '<span class="snippet-name">' + escHtml(s.name) + '</span>';
      html += '<span class="snippet-category ' + escHtml(s.category || "custom") + '">' + escHtml(s.category || "custom") + '</span>';
      html += '</div>';
      html += '<div class="snippet-cmd">' + escHtml(s.command) + '</div>';
      if (s.description) html += '<div class="snippet-desc">' + escHtml(s.description) + '</div>';
      html += '<button class="snippet-del-btn" onclick="event.stopPropagation();deleteSnippet(\'' + escHtml(s.name).replace(/'/g, "\\'") + '\')">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      html += '</button>';
      html += '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  window.runSnippet = function (name) {
    var snippet = allSnippets.find(function (s) { return s.name === name; });
    if (!snippet) return;
    closeSnippets();
    sendWs(snippet.command + "\n");
    showToast(snippet.name + " 실행");
  };

  window.addSnippet = function () {
    var name = prompt("스니펫 이름:");
    if (!name || !name.trim()) return;
    var command = prompt("명령어:");
    if (!command) return;
    var category = prompt("카테고리 (system/git/docker/ml/claude/custom):", "custom");
    if (!category) category = "custom";
    var description = prompt("설명 (선택):", "");

    var url = "/api/snippets?action=save" +
      "&name=" + encodeURIComponent(name.trim()) +
      "&command=" + encodeURIComponent(command) +
      "&category=" + encodeURIComponent(category) +
      "&description=" + encodeURIComponent(description || "");
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("스니펫 추가 완료"); fetchSnippets(); }
        else showToast(data.error || "추가 실패", true);
      })
      .catch(function (e) { showToast("오류: " + e.message, true); });
  };

  window.deleteSnippet = function (name) {
    if (!confirm("'" + name + "' 스니펫을 삭제하시겠습니까?")) return;
    fetch("/api/snippets?action=delete&name=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { showToast("삭제 완료"); fetchSnippets(); }
        else showToast(data.error || "삭제 실패", true);
      })
      .catch(function (e) { showToast("오류: " + e.message, true); });
  };

  // ══════════════════════════════════════════════════
  // Feature: Image Viewer (in file viewer)
  // ══════════════════════════════════════════════════
  function renderImage(data) {
    var body = $("#viewer-body");
    var imgUrl = "/api/image?path=" + encodeURIComponent(data.path);
    body.innerHTML = '<div class="image-viewer-wrap"><img src="' + imgUrl + '" class="image-viewer-img" alt="' + escHtml(data.path.split("/").pop()) + '" onclick="this.classList.toggle(\'zoomed\')"></div>';
    $("#btn-download").style.display = "flex";
    editingPath = data.path;
  }

  // ══════════════════════════════════════════════════
  // Feature: System Info
  // ══════════════════════════════════════════════════
  window.openSysinfo = function () {
    $("#sysinfo-panel").classList.remove("hidden");
    fetchSysinfo();
  };

  window.closeSysinfo = function () {
    $("#sysinfo-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };

  window.refreshSysinfo = function () {
    fetchSysinfo();
  };

  async function fetchSysinfo() {
    var body = $("#sysinfo-body");
    body.innerHTML = '<div class="file-empty">불러오는 중...</div>';
    try {
      var res = await fetch("/api/sysinfo");
      var info = await res.json();
      var html = '<div class="sysinfo-grid">';

      html += '<div class="sysinfo-card"><div class="sysinfo-card-title">OS</div>';
      html += '<div class="sysinfo-row"><span>이름</span><span>' + escHtml(info.os || "Linux") + '</span></div>';
      html += '<div class="sysinfo-row"><span>커널</span><span>' + escHtml(info.kernel || "") + '</span></div>';
      html += '<div class="sysinfo-row"><span>호스트명</span><span>' + escHtml(info.hostname || "") + '</span></div>';
      html += '<div class="sysinfo-row"><span>아키텍처</span><span>' + escHtml(info.arch || "") + '</span></div>';
      html += '<div class="sysinfo-row"><span>업타임</span><span>' + escHtml(info.uptime || "") + '</span></div>';
      html += '</div>';

      html += '<div class="sysinfo-card"><div class="sysinfo-card-title">CPU</div>';
      html += '<div class="sysinfo-row"><span>모델</span><span>' + escHtml(info.cpu_model || "unknown") + '</span></div>';
      html += '<div class="sysinfo-row"><span>코어 수</span><span>' + (info.cpu_count || 0) + '</span></div>';
      html += '</div>';

      html += '<div class="sysinfo-card"><div class="sysinfo-card-title">메모리</div>';
      html += '<div class="sysinfo-row"><span>총 RAM</span><span>' + fmtBytes(info.ram_total || 0) + '</span></div>';
      html += '</div>';

      if (info.gpus && info.gpus.length > 0) {
        html += '<div class="sysinfo-card"><div class="sysinfo-card-title">GPU</div>';
        info.gpus.forEach(function (gpu, i) {
          html += '<div class="sysinfo-row"><span>GPU ' + i + '</span><span>' + escHtml(gpu.name) + '</span></div>';
          if (gpu.vram) html += '<div class="sysinfo-row"><span>VRAM</span><span>' + escHtml(gpu.vram) + '</span></div>';
          if (gpu.driver) html += '<div class="sysinfo-row"><span>드라이버</span><span>' + escHtml(gpu.driver) + '</span></div>';
        });
        html += '</div>';
      }

      if (info.disks && info.disks.length > 0) {
        html += '<div class="sysinfo-card"><div class="sysinfo-card-title">디스크</div>';
        info.disks.forEach(function (d) {
          html += '<div class="sysinfo-row"><span>' + escHtml(d.mount) + '</span><span>' + escHtml(d.used) + ' / ' + escHtml(d.size) + ' (' + escHtml(d.pcent) + ')</span></div>';
        });
        html += '</div>';
      }

      if (info.network && info.network.length > 0) {
        html += '<div class="sysinfo-card"><div class="sysinfo-card-title">네트워크</div>';
        info.network.forEach(function (n) {
          html += '<div class="sysinfo-row"><span>' + escHtml(n.name) + ' <small style="color:var(--text3)">' + escHtml(n.state) + '</small></span><span>' + escHtml(n.addr) + '</span></div>';
        });
        html += '</div>';
      }

      html += '<div class="sysinfo-card"><div class="sysinfo-card-title">소프트웨어</div>';
      html += '<div class="sysinfo-row"><span>Python</span><span>' + escHtml(info.python || "") + '</span></div>';
      html += '<div class="sysinfo-row"><span>Docker</span><span>' + escHtml(info.docker || "not installed") + '</span></div>';
      html += '</div>';

      html += '</div>';
      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="file-empty">불러오기 실패: ' + escHtml(e.message) + '</div>';
    }
  }

  // ══════════════════════════════════════════════════
  // Feature: Quick Commands
  // ══════════════════════════════════════════════════
  window.openQuickCmd = function () {
    $("#quickcmd-panel").classList.remove("hidden");
    renderQuickCmds();
  };

  window.closeQuickCmd = function () {
    $("#quickcmd-panel").classList.add("hidden");
    setTimeout(doFit, 50);
  };

  function renderQuickCmds() {
    var body = $("#quickcmd-body");
    var cmds = [
      { name: "python_procs", label: "Python 프로세스", desc: "실행 중인 Python 프로세스 확인", icon: "\uD83D\uDC0D" },
      { name: "gpu_procs", label: "GPU 프로세스", desc: "GPU 사용 중인 프로세스 목록", icon: "\uD83C\uDFAE" },
      { name: "ports", label: "포트 사용", desc: "열린 포트 및 리스닝 서비스", icon: "\uD83D\uDD0C" },
      { name: "big_files", label: "디스크 큰 파일", desc: "현재 디렉토리에서 큰 파일 순", icon: "\uD83D\uDCBE" },
      { name: "recent_files", label: "최근 수정 파일", desc: "최근 1시간 내 수정된 파일", icon: "\uD83D\uDD52" },
      { name: "log_errors", label: "로그 에러", desc: "시스템 로그에서 에러 검색", icon: "\u26A0\uFE0F" },
    ];
    var html = '<div class="quickcmd-grid">';
    cmds.forEach(function (cmd) {
      html += '<button class="quickcmd-btn" onclick="runQuickCmd(\'' + cmd.name + '\')">';
      html += '<span class="quickcmd-icon">' + cmd.icon + '</span>';
      html += '<span class="quickcmd-label">' + escHtml(cmd.label) + '</span>';
      html += '<span class="quickcmd-desc">' + escHtml(cmd.desc) + '</span>';
      html += '</button>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  window.runQuickCmd = async function (name) {
    try {
      var res = await fetch("/api/quickcmd?name=" + encodeURIComponent(name));
      var data = await res.json();
      if (data.command) {
        closeQuickCmd();
        sendWs(data.command + "\n");
        showToast("실행: " + name);
      }
    } catch (e) {
      showToast("오류: " + e.message, true);
    }
  };

  // ══════════════════════════════════════════════════
  // Feature: Terminal History Search
  // ══════════════════════════════════════════════════
  var historyCommands = [];

  window.openHistory = async function () {
    $("#history-popup").classList.remove("hidden");
    var searchInput = document.getElementById("history-search");
    if (searchInput) searchInput.value = "";
    await fetchHistory();
  };

  window.closeHistory = function () {
    $("#history-popup").classList.add("hidden");
  };

  async function fetchHistory(query) {
    var url = "/api/history?count=50";
    if (query) url += "&q=" + encodeURIComponent(query);
    try {
      var res = await fetch(url);
      var data = await res.json();
      historyCommands = data.commands || [];
      renderHistoryList();
    } catch (e) {
      document.getElementById("history-list").innerHTML = '<div class="file-empty">불러오기 실패</div>';
    }
  }

  window.filterHistory = function () {
    var q = (document.getElementById("history-search") || {}).value || "";
    fetchHistory(q);
  };

  function renderHistoryList() {
    var container = document.getElementById("history-list");
    if (!historyCommands.length) {
      container.innerHTML = '<div class="file-empty">히스토리 없음</div>';
      return;
    }
    var html = '';
    historyCommands.forEach(function (cmd) {
      html += '<button class="history-item" onclick="executeHistory(this)" data-cmd="' + escHtml(cmd).replace(/"/g, '&quot;') + '">';
      html += escHtml(cmd);
      html += '</button>';
    });
    container.innerHTML = html;
  }

  window.executeHistory = function (el) {
    var cmd = el.getAttribute("data-cmd");
    if (!cmd) return;
    closeHistory();
    sendWs(cmd + "\n");
    showToast("실행: " + (cmd.length > 40 ? cmd.substring(0, 40) + "..." : cmd));
  };

  // ── Init ───────────────────────────────────────
  initTerminal();
  setupInputBar();
  connect();
  startAlertPolling();

  // No service worker registration -- causes caching issues

})();
