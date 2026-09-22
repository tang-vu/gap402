import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Gap402 } from "@gap402/sdk";

/**
 * gap402 MCP server — exposes the evidence market to MCP-capable agents.
 *
 * Transport: stdio. Configure the target API with GAP402_API
 * (default http://127.0.0.1:4020).
 */

const client = new Gap402({
  api: process.env.GAP402_API ?? "http://127.0.0.1:4020",
  writeToken: process.env.GAP402_WRITE_TOKEN,
});

const server = new McpServer({
  name: "gap402",
  version: "0.1.0",
});

const text = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }],
});

server.registerTool(
  "gap402_get_proof",
  {
    description:
      "Export the bounty specification, settlement plan and receipt for independent offline integrity checks. Does not prove source truth or query the chain.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => text(await client.getProof(id)),
);

server.registerTool(
  "gap402_create_gap",
  {
    description:
      "Create an evidence gap: convert an unsupported claim into a USDC-funded bounty on Arc.",
    inputSchema: {
      question: z.string().describe("Research question"),
      claim: z.string().describe("Exact claim requiring evidence"),
      budget: z.string().describe("Bounty in USDC, e.g. '0.05'"),
      context: z.string().optional(),
      deadlineSeconds: z.number().int().positive().optional(),
      requirements: z.record(z.string(), z.unknown()).optional(),
      requesterAddress: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .optional(),
    },
  },
  async (a) => {
    const c = a.requesterAddress
      ? new Gap402({
          api: process.env.GAP402_API ?? "http://127.0.0.1:4020",
          requester: {
            id: "mcp-agent",
            kind: "service",
            address: a.requesterAddress as `0x${string}`,
          },
        })
      : client;
    return text(
      await c.createGap({
        question: a.question,
        claim: a.claim,
        context: a.context,
        budget: a.budget,
        deadlineSeconds: a.deadlineSeconds,
        requirements: a.requirements,
      }),
    );
  },
);

server.registerTool(
  "gap402_get_gap",
  {
    description: "Get a gap's status, submissions, evaluations and plan.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => text(await client.getGap(id)),
);

server.registerTool(
  "gap402_search_open_gaps",
  {
    description: "List open evidence gaps suppliers can fulfil.",
    inputSchema: {},
  },
  async () => text(await client.listGaps({ status: "open" })),
);

server.registerTool(
  "gap402_submit_evidence",
  {
    description: "Submit candidate evidence to an open gap.",
    inputSchema: {
      gapId: z.string(),
      url: z.string().url(),
      supplierAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      title: z.string().optional(),
      publisher: z.string().optional(),
      publishedAt: z.string().optional(),
      excerpt: z.string().optional(),
      claimRelation: z
        .enum(["supports", "contradicts", "contextual", "unrelated"])
        .optional(),
      sourceType: z
        .enum(["official", "primary", "independent", "aggregated", "social", "wiki"])
        .optional(),
    },
  },
  async (a) =>
    text(
      await client.submitEvidence(a.gapId, {
        url: a.url,
        supplierAddress: a.supplierAddress as `0x${string}`,
        title: a.title,
        publisher: a.publisher,
        publishedAt: a.publishedAt,
        excerpt: a.excerpt,
        claimRelation: a.claimRelation,
        sourceType: a.sourceType,
      }),
    ),
);

server.registerTool(
  "gap402_cancel_gap",
  {
    description:
      "Cancel an expired gap and reclaim its escrow. Only works after the deadline; funded gaps refund onchain.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => text(await client.cancelGap(id)),
);

server.registerTool(
  "gap402_get_receipt",
  {
    description: "Fetch a cryptographic Evidence Receipt (by receipt id or gap id).",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const byBounty = await client.getReceiptByBounty(id).catch(() => null);
    if (byBounty) return text(byBounty);
    return text(await client.getReceipt(id));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("gap402 mcp server ready (stdio)");
