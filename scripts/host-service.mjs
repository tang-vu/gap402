// Keep the Windows PM2 dashboard while using the repository's Linux dependencies.
// Closing the supervisor pipe terminates the Linux child, avoiding orphaned ports.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const role = process.argv[2];
if (role !== "api" && role !== "web") throw new Error("Expected api or web");
const windows = process.platform === "win32";
let child;
let stopping = false;
let stopTimer;

function stop() {
  if (stopping) return;
  stopping = true;
  if (windows) child.stdin.end();
  else child.kill("SIGTERM");
  stopTimer = setTimeout(() => child.kill("SIGKILL"), 8000);
  stopTimer.unref();
}

if (windows) {
  const linuxRoot = `/mnt/${root[0].toLowerCase()}${root.slice(2).replaceAll("\\", "/")}`;
  child = spawn(
    path.join(process.env.SystemRoot ?? "C:/Windows", "System32/wsl.exe"),
    [
      "-d",
      process.env.GAP402_WSL_DISTRO ?? "Ubuntu",
      "--cd",
      linuxRoot,
      "--exec",
      "/usr/local/bin/node",
      `${linuxRoot}/scripts/host-service.mjs`,
      role,
    ],
    { cwd: root, stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
  );
} else {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    GAP402_NETWORK: "local",
    MAINNET_ENABLED: "false",
    VERIFIER_PROVIDER: "mock",
    API_HOST: "127.0.0.1",
    API_PORT: "4020",
    GAP402_API: "http://127.0.0.1:4020",
    DATABASE_URL: path.join(root, "data", "host-demo.db"),
    GAP402_WRITE_TOKEN: randomBytes(32).toString("hex"),
  };
  for (const key of ["PRIVATE_KEY", "VERIFIER_PRIVATE_KEY", "GAP_BOUNTY_ADDRESS"])
    delete env[key];
  const args =
    role === "api"
      ? ["--import", "tsx", "apps/api/src/index.ts"]
      : [
          "apps/web/node_modules/next/dist/bin/next",
          "start",
          "apps/web",
          "-H",
          "127.0.0.1",
          "-p",
          "3043",
        ];
  child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  process.stdin.resume();
  process.stdin.once("end", stop);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.on("message", (message) => {
  if (message === "shutdown") stop();
});
child.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.once("exit", (code) => {
  clearTimeout(stopTimer);
  process.exit(stopping ? 0 : (code ?? 1));
});
