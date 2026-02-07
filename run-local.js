/**
 * Launcher: start backend and frontend without visible CMD windows.
 * Close this console window to stop both services.
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { exec } = require("child_process");

const root = __dirname;
const backendDir = path.join(root, "backend");
const isWin = process.platform === "win32";

let backendProc = null;
let frontendProc = null;

function killChildren() {
  if (backendProc && backendProc.pid) {
    try {
      if (isWin) {
        spawn("taskkill", ["/pid", String(backendProc.pid), "/f", "/t"], { stdio: "ignore" });
      } else {
        backendProc.kill("SIGTERM");
      }
    } catch (_) {}
    backendProc = null;
  }
  if (frontendProc && frontendProc.pid) {
    try {
      if (isWin) {
        spawn("taskkill", ["/pid", String(frontendProc.pid), "/f", "/t"], { stdio: "ignore" });
      } else {
        frontendProc.kill("SIGTERM");
      }
    } catch (_) {}
    frontendProc = null;
  }
}

function onExit() {
  killChildren();
  process.exit(0);
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);
process.on("exit", killChildren);

// Backend: python main.py from backend dir (prefer .venv if present)
const venvPython = path.join(backendDir, ".venv", "Scripts", "python.exe");
const pythonCmd = isWin && fs.existsSync(venvPython) ? venvPython : "python";
backendProc = spawn(pythonCmd, ["main.py"], {
  cwd: backendDir,
  stdio: "ignore",
  windowsHide: true,
  shell: false,
});
backendProc.on("error", (err) => console.error("[Launcher] Backend start error:", err.message));

// Frontend: npm run dev from project root (shell needed on Windows for npm)
frontendProc = spawn(isWin ? "npm.cmd" : "npm", ["run", "dev"], {
  cwd: root,
  stdio: "ignore",
  windowsHide: true,
  shell: isWin,
});
frontendProc.on("error", (err) => console.error("[Launcher] Frontend start error:", err.message));

// Open browser after delay
setTimeout(() => {
  const url = "http://localhost:3000";
  if (isWin) {
    exec(`start "" "${url}"`, () => {});
  } else {
    exec(`open "${url}"`, () => {});
  }
}, 8000);

console.log("");
console.log("[XHS Factory] Backend and frontend started (no extra CMD windows).");
console.log("[XHS Factory] Browser will open in ~8 sec. If not, open http://localhost:3000");
console.log("");
console.log(">>> Close this window to stop backend and frontend. <<<");
console.log("");
