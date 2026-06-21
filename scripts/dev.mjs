// Start the desktop (:8090) and terminal (:7777) together. The agent/workspace runtime (Nodus) is a
// separate service — kept out of this repo. Point NODUS_DIR at a local Nodus checkout to also bring
// it up here:  NODUS_DIR=~/path/to/Nodus-backend npm run dev
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let stopping = false;
const procs = [];
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) { try { p.kill("SIGINT"); } catch {} }
  setTimeout(() => process.exit(0), 250);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const run = (label, cmd, args, opts = {}) => {
  const p = spawn(cmd, args, { stdio: "inherit", ...opts, env: { ...process.env, ...(opts.env || {}) } });
  p.on("exit", (code) => { console.log(`[${label}] exited (${code})`); stop(); });
  procs.push(p);
};

console.log("lunix dev → terminal :7777 · desktop :8090" + (process.env.NODUS_DIR ? " · runtime :8787" : ""));

// Optional: bring up an external Nodus runtime if NODUS_DIR is provided.
if (process.env.NODUS_DIR) {
  run("runtime", npm, ["run", "dev"], {
    cwd: process.env.NODUS_DIR.replace(/^~/, process.env.HOME || ""),
    env: {
      NODUS_REPOSITORY_DRIVER: process.env.NODUS_REPOSITORY_DRIVER || "memory",
      NODUS_WORKSPACE_RUNTIME_DRIVER: process.env.NODUS_WORKSPACE_RUNTIME_DRIVER || "local",
    },
  });
}
run("terminal", npm, ["run", "terminal:web"]);
run("desktop", npm, ["run", "desktop"]);
