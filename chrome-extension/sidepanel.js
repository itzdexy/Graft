const PERMISSION_LABELS = {
  ask: "Ask before acting",
  follow_a_plan: "Follow a plan",
  skip_all_permission_checks: "Act without asking",
};

const $ = (id) => document.getElementById(id);

const els = {
  statusDot: $("statusDot"),
  statusText: $("statusText"),
  modelName: $("modelName"),
  welcome: $("welcome"),
  messages: $("messages"),
  promptInput: $("promptInput"),
  sendBtn: $("sendBtn"),
  permissionBtn: $("permissionBtn"),
  permissionLabel: $("permissionLabel"),
  permissionMenu: $("permissionMenu"),
  mainMenu: $("mainMenu"),
};

let permissionMode = "ask";
let connected = false;
let activityHydrated = false;

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hideWelcome() {
  els.welcome.hidden = true;
  els.messages.hidden = false;
}

function appendMessage(kind, html, meta = {}) {
  hideWelcome();
  const div = document.createElement("div");
  div.className = `msg ${kind}`;
  div.innerHTML = html;
  const time = document.createElement("time");
  time.textContent = formatTime(meta.date ? new Date(meta.date) : new Date());
  div.appendChild(time);
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function setConnectionStatus(state) {
  connected = state.connected;
  els.statusDot.className = "status-dot";
  if (state.connected) {
    els.statusDot.classList.add("connected");
    els.statusText.textContent = state.model
      ? `Connected · ${state.model}`
      : "Connected to Tovyr CLI";
    els.sendBtn.disabled = false;
    if (state.model) els.modelName.textContent = state.model;
  } else {
    els.statusDot.classList.add("disconnected");
    els.statusText.textContent =
      state.hint || "Not connected — run kairo --chrome in your project";
    els.sendBtn.disabled = false;
  }
}

function setPermissionMode(mode) {
  permissionMode = mode;
  els.permissionLabel.textContent = PERMISSION_LABELS[mode] || PERMISSION_LABELS.ask;
  for (const btn of els.permissionMenu.querySelectorAll("button")) {
    btn.setAttribute("aria-selected", btn.dataset.mode === mode ? "true" : "false");
  }
  chrome.storage.local.set({ permissionMode: mode });
  chrome.runtime.sendMessage({ type: "set_permission_mode", mode }).catch(() => {});
}

function toggleMenu(menu, show) {
  menu.hidden = !show;
  if (show) {
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.hidden = true;
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
}

async function refreshStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "get_ui_status" });
    if (status) {
      setConnectionStatus(status);
      if (status.permissionMode) setPermissionMode(status.permissionMode);
      if (!activityHydrated && Array.isArray(status.activity) && status.activity.length > 0) {
        activityHydrated = true;
        for (const item of status.activity.slice(-30)) {
          if (item.kind === "tool") {
            appendMessage(
              "tool",
              `<span class="tool-name">${escapeHtml(item.tool)}</span>${escapeHtml(item.summary || "")}`,
              { date: item.ts },
            );
          }
        }
      }
    }
  } catch {
    setConnectionStatus({ connected: false, hint: "Extension background unavailable" });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function autoResizeTextarea() {
  const ta = els.promptInput;
  ta.style.height = "auto";
  ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
}

function sendPrompt() {
  const text = els.promptInput.value.trim();
  if (!text) return;

  appendMessage("user", escapeHtml(text));
  els.promptInput.value = "";
  autoResizeTextarea();

  navigator.clipboard.writeText(text).catch(() => {});

  chrome.runtime
    .sendMessage({ type: "user_prompt", text })
    .then(() => {
      appendMessage(
        "system",
        connected
          ? "Copied to clipboard — paste into your Tovyr terminal (Ctrl+V)."
          : "Copied to clipboard. If Tovyr is already running with <code>kairo --chrome</code>, run <code>kairo chrome setup --extension-id YOUR_ID</code> and restart the browser.",
      );
    })
    .catch(() => {
      appendMessage("system", "Could not reach extension background.");
    });
}

// Events
els.promptInput.addEventListener("input", autoResizeTextarea);
els.promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});

els.sendBtn.addEventListener("click", sendPrompt);

els.permissionBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu(els.permissionMenu, els.permissionMenu.hidden);
});

els.permissionMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn) return;
  setPermissionMode(btn.dataset.mode);
  els.permissionMenu.hidden = true;
});

$("menuBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu(els.mainMenu, els.mainMenu.hidden);
});

$("newChatBtn").addEventListener("click", () => {
  els.messages.innerHTML = "";
  els.welcome.hidden = false;
  els.messages.hidden = true;
  activityHydrated = false;
  chrome.runtime.sendMessage({ type: "clear_activity" }).catch(() => {});
});

$("setupHelpBtn").addEventListener("click", () => {
  appendMessage(
    "system",
    `<strong>Quick setup</strong><br>
1. Load this folder at chrome://extensions<br>
2. Run <code>kairo chrome setup --extension-id YOUR_ID</code><br>
3. Restart the browser<br>
4. In a project folder: <code>kairo --chrome</code>`,
  );
});

$("copySetupCmd").addEventListener("click", async () => {
  await navigator.clipboard.writeText("kairo --chrome");
  appendMessage("system", "Copied <code>kairo --chrome</code> to clipboard.");
  els.mainMenu.hidden = true;
});

$("openExtensions").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions" });
  els.mainMenu.hidden = true;
});

$("refreshStatus").addEventListener("click", () => {
  refreshStatus();
  els.mainMenu.hidden = true;
});

$("pickElementBtn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: "startElementPicker" }).catch(async () => {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "startElementPicker" });
    });
    appendMessage("system", "Click an element on the page to copy its ref (if supported).");
  } catch {
    appendMessage("system", "Could not start element picker on this tab.");
  }
});

$("modelBtn").addEventListener("click", () => {
  appendMessage(
    "system",
    "Model is chosen in the Tovyr CLI (<code>kairo models</code> or your provider config).",
  );
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ui_activity") {
    if (msg.tool) {
      appendMessage(
        "tool",
        `<span class="tool-name">${escapeHtml(msg.tool)}</span>${escapeHtml(msg.summary || "completed")}`,
        { date: msg.ts },
      );
    }
  }
  if (msg.type === "ui_status") {
    setConnectionStatus(msg);
  }
});

chrome.storage.local.get(["permissionMode"], (data) => {
  if (data.permissionMode) setPermissionMode(data.permissionMode);
});

refreshStatus();
setInterval(refreshStatus, 5000);
