const path = require("node:path");

const root = __dirname;
const common = {
  cwd: root,
  autorestart: true,
  restart_delay: 5000,
  min_uptime: 30000,
  max_restarts: 10,
  kill_timeout: 12000,
  time: true,
  watch: false,
};

module.exports = {
  apps: [
    ...["api", "web"].map((role) => ({
      ...common,
      name: `gap402-${role}`,
      script: path.join(root, "scripts", "host-service.mjs"),
      args: [role],
      interpreter: process.execPath,
      shutdown_with_message: true,
      env: { GAP402_WSL_DISTRO: "Ubuntu" },
    })),
    {
      ...common,
      name: "gap402-tunnel",
      script: "C:/Program Files (x86)/cloudflared/cloudflared.exe",
      interpreter: "none",
      args: [
        "tunnel",
        "--no-autoupdate",
        "--config",
        path.join(process.env.LOCALAPPDATA, "Gap402", "cloudflared.yml"),
        "run",
      ],
    },
  ],
};
