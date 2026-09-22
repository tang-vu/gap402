// Review-only adapter. Actual demo responses, held in memory; no stored market writes.
import http from "node:http";
const origin = process.env.UI_API ?? "http://127.0.0.1:4020";
const runs = {};
for (const scenario of ["mixed", "rejected", "insufficient"]) {
  const response = await fetch(`${origin}/api/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  if (!response.ok) throw new Error(`Demo fixture unavailable: ${response.status}`);
  runs[scenario] = await response.json();
}
let mode = "populated";
http
  .createServer(async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Content-Type", "application/json");
    const send = (value, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(value));
    };
    if (path.startsWith("/__review/")) {
      mode = path.split("/").at(-1);
      return send({ mode });
    }
    if (mode === "offline") return send({ error: "Review API unavailable" }, 503);
    if (path === "/api/health")
      return send({
        ok: true,
        network: mode === "unknown" ? "unknown" : "local",
        chainId: 31337,
        settlementMode: "review fixtures / offchain",
        verificationMode: "mock-v1",
        bountyContract: null,
      });
    if (path === "/api/demo") {
      let text = "";
      for await (const chunk of req) text += chunk;
      const scenario = JSON.parse(text || "{}").scenario ?? "mixed";
      return send(runs[scenario] ?? { error: "Unknown scenario" });
    }
    if (path === "/api/gaps")
      return send({
        gaps:
          mode === "empty"
            ? []
            : Object.values(runs).map((r) => ({
                gap: r.gap,
                runtime: { network: "local" },
                submissionCount: r.submissions.length,
              })),
      });
    if (path === "/api/receipts")
      return send({
        receipts:
          mode === "empty"
            ? []
            : Object.values(runs).flatMap((r) => (r.receipt ? [r.receipt] : [])),
      });
    const selected = Object.values(runs).find(
      (r) => path.includes(r.gap.id) || (r.receipt && path.includes(r.receipt.id)),
    );
    if (!selected) return send({ error: "Not found" }, 404);
    if (path.endsWith("/proof"))
      return send({ gap: selected.gap, plan: selected.plan, receipt: selected.receipt });
    if (path.endsWith("/receipt") || path.startsWith("/api/receipts/"))
      return send(selected.receipt);
    if (mode === "stress") {
      const submissions = Array.from({ length: 45 }, (_, i) => ({
        ...selected.submissions[0],
        id: `review-source-${i}`,
        title: `Review fixture ${i + 1}: ${"A long supplier-declared title with uncertain provenance. ".repeat(5)}`,
        canonicalUrl:
          i === 44 ? "javascript:alert(1)" : `https://review.example.com/${i}`,
        publishedAt: undefined,
        publisher: undefined,
      }));
      return send({
        ...selected,
        gap: { ...selected.gap, claim: "Long claim fixture. ".repeat(80) },
        submissions,
        evaluations: [],
        plan: null,
        receipt: null,
        runtime: {},
        submissionCount: submissions.length,
        explorer: { fundTx: null, settlementTx: null },
      });
    }
    return send({
      ...selected,
      runtime: { network: "local" },
      submissionCount: selected.submissions.length,
      explorer: { fundTx: null, settlementTx: null },
    });
  })
  .listen(4028, "127.0.0.1", () =>
    console.log("Review-only fixture API: http://127.0.0.1:4028"),
  );
