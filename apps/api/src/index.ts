import { buildServer } from "./server.js";

const port = Number(process.env.API_PORT ?? 4020);
const host = process.env.API_HOST ?? "127.0.0.1";

const app = await buildServer();
await app.listen({ port, host });
console.log(`gap402 api listening on http://${host}:${port}`);
