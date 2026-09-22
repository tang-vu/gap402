// Idempotent logon entry: leave already-running apps (including other projects) alone.
const pm2 = require("D:/Node/node_modules/pm2");
const { apps } = require("../ecosystem.config.cjs");
const call = (method, ...args) =>
  new Promise((resolve, reject) =>
    pm2[method](...args, (error, result) => (error ? reject(error) : resolve(result))),
  );

(async () => {
  await call("connect");
  try {
    const existing = await call("list");
    for (const app of apps) {
      const entry = existing.find((item) => item.name === app.name);
      if (entry && ["online", "launching"].includes(entry.pm2_env.status)) continue;
      if (entry) await call("restart", entry.pm_id);
      else await call("start", app);
    }
    console.log("Gap402 PM2 services are started.");
  } finally {
    pm2.disconnect();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
