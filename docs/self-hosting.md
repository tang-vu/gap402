# Gap402 on the builder's Windows machine

Public demo: **https://gap402.tangvu.dev**

The market and Evidence Lab are a public product sandbox. Evidence fixtures and
semantic scores there are simulated, and actual spend is zero. A separate
[`/mainnet`](https://gap402.tangvu.dev/mainnet) page presents a recorded Arc
mainnet settlement with explorer links and a downloadable proof. The public
runtime deliberately clears signing keys and contract settings.

## Runtime

| PM2 name | Purpose | Listener |
| --- | --- | --- |
| `gap402-web` | Next production build in Ubuntu WSL | `127.0.0.1:3043` |
| `gap402-api` | Gap402 API in Ubuntu WSL | `127.0.0.1:4020` |
| `gap402-tunnel` | Dedicated Windows Cloudflare connector | HTTPS hostname to web only |

The existing Windows PM2 daemon manages all three. `host-service.mjs` bridges to
the repository's installed Linux dependencies. It closes Linux children on PM2
shutdown through an stdin pipe; unexpected child exits propagate to PM2 for
restart. Only loopback ports are bound. No generic API route is exposed by the
tunnel: Next's `/api/demo` proxy reaches the isolated in-memory simulation.

`data/host-demo.db` is separate from the development database and ignored by Git.
The API receives a fresh random write token at each launch (never logged); the
public sandbox has no operator write client. This hosting profile is intentionally
fixed to local/mock mode. Use the mainnet deployment runbook for a funded service.

## Machine configuration

- Checkout: `D:\Github\Hackathon\gap402`.
- Windows Node/PM2: `D:\Node`; WSL distro `Ubuntu`, Node `/usr/local/bin/node`.
- Cloudflare config: `%LOCALAPPDATA%\Gap402\cloudflared.yml`.
- Tunnel: `gap402`, UUID `be6af0cd-f3f2-41dd-ac96-8714a0af5c15`.
- Credential JSON remains under `%USERPROFILE%\.cloudflared`, outside the repo.
- Ingress matches only `gap402.tangvu.dev` and falls back to HTTP 404.
- Connector metrics bind only `127.0.0.1:20443`.
- Scheduled task **Gap402 PM2 Start** runs at user logon, hidden, and only starts
  missing/stopped Gap402 processes. Repeated starts leave online processes alone.
  This is logon startup, not a promise of availability before Windows sign-in.
- The shared PM2 process list has been saved. Existing project processes, DNS
  routes and the disabled shared PM2 startup task were left unchanged.

The machine must remain awake and connected to the Internet. PM2 cannot serve
traffic during power loss, sleep, reboot or a network outage.

## Operations (Windows PowerShell)

```powershell
# Idempotent startup, also used by Task Scheduler
& .\scripts\start-host.ps1

pm2 status
pm2 logs gap402-web --lines 30
pm2 logs gap402-api --lines 30
pm2 logs gap402-tunnel --lines 30

# Restart only Gap402; expect a brief cold-start interruption
pm2 restart gap402-api gap402-web
pm2 restart gap402-tunnel
pm2 save
```

For a frontend update, stop `gap402-web`, build with
`wsl -d Ubuntu --exec bash -lc 'cd /mnt/d/Github/Hackathon/gap402 && pnpm --filter @gap402/web build'`,
then start it again with `scripts/start-host.ps1`. Do not rebuild `.next` while
the production process reads it. A single instance has deployment downtime.
For API source changes restart `gap402-api` after the relevant tests pass.

To retire this host, stop only the three named PM2 processes and disable only
the `Gap402 PM2 Start` task. DNS/tunnel deletion is a separate deliberate action.

## Validation

Validated ingress configuration, HTTPS homepage and all four main subpages,
three public lab scenarios, no-spend labels, and offline proof integrity.
The unsupported public write endpoint returned 404; an unauthenticated direct
local API write returned 401. A controlled PM2 restart replaced web/API PIDs,
removed their old Linux children, and restored the same listener ports.
The logon task was run manually and returned success; repeated startup preserved
the running PIDs. A full machine reboot was not performed.

References: [PM2 ecosystem options](https://pm2.io/docs/runtime/reference/ecosystem-file/),
[Cloudflare locally managed tunnel setup](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/).
