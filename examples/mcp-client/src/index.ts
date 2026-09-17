import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Example MCP client: spawns the gap402 MCP server over stdio, lists tools,
 * and queries open gaps. Run with the API up:
 *
 *   GAP402_API=http://127.0.0.1:4020 pnpm --filter @gap402/example-mcp-client start
 */

const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--filter", "@gap402/mcp", "start"],
  env: {
    ...process.env,
    GAP402_API: process.env.GAP402_API ?? "http://127.0.0.1:4020",
  } as Record<string, string>,
});

const client = new Client({ name: "gap402-example-client", version: "0.1.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const open = await client.callTool({
  name: "gap402_search_open_gaps",
  arguments: {},
});
console.log("open gaps:", JSON.stringify(open.content, null, 2));

await client.close();
