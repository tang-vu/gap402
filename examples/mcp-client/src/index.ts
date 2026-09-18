import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Example MCP client: spawns the gap402 MCP server over stdio and exercises
 * a write + read round-trip. Run with the API up:
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

// An agent that cannot resolve a claim creates a market for it.
const created = await client.callTool({
  name: "gap402_create_gap",
  arguments: {
    question: "Has Acme Corp deployed WidgetNet in Vietnam?",
    claim: "Acme Corp deployed WidgetNet in Vietnam before 2026-09-01",
    budget: "0.05",
    deadlineSeconds: 3600,
    requesterAddress: "0x1000000000000000000000000000000000000001",
  },
});
const createdText = (created.content as { text: string }[])[0]!.text;
const gapId = JSON.parse(createdText).gap.id as string;
console.log("created gap:", gapId);

const open = await client.callTool({
  name: "gap402_search_open_gaps",
  arguments: {},
});
const openText = (open.content as { text: string }[])[0]!.text;
console.log("open gaps:", JSON.parse(openText).gaps.length);

const detail = await client.callTool({
  name: "gap402_get_gap",
  arguments: { id: gapId },
});
console.log("gap detail:", (detail.content as { text: string }[])[0]!.text);

await client.close();
