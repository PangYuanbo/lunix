// Start the desktop (:8090) and the embedded terminal (:7777) together. Zero deps — just spawns the
// two workspace scripts and tears both down on Ctrl-C / when either exits.
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (label, script) => {
  const p = spawn(npm, ["run", script], { stdio: ["inherit", "inherit", "inherit"] });
  p.on("exit", (code) => { console.log(`[${label}] exited (${code})`); stop(); });
  return p;
};

let stopping = false;
const procs = [];
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) { try { p.kill("SIGINT"); } catch {} }
  setTimeout(() => process.exit(0), 200);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("lunix dev → desktop http://localhost:8090   ·   terminal http://localhost:7777");
procs.push(run("terminal", "terminal:web"));
procs.push(run("desktop", "desktop"));
