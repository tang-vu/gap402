# Keryx adapter (reference consumer)

Gap402 is an independent protocol. This directory shows how a research
pipeline such as Keryx would consume it — no Keryx code is required and
Gap402 has no dependency on Keryx.

```text
question
  -> research sources
  -> evidence coverage analysis          (detectGap)
  -> sufficient?  yes -> answer normally
              no  -> Gap402 bounty       (openGap)
  -> await EvidenceReceipt               (awaitGap)
  -> merge accepted evidence             (mergeEvidence)
  -> re-evaluate coverage, continue answer
```

## Usage

```ts
import { Gap402 } from "@gap402/sdk";
import { KeryxAdapter } from "@gap402/example-keryx-adapter";

const adapter = new KeryxAdapter(new Gap402({ api: "http://127.0.0.1:4020" }));

const detection = adapter.detectGap({ question, claims, currentEvidence });
if (detection.insufficient && detection.targetClaim) {
  const gap = await adapter.openGap({
    question,
    claim: detection.targetClaim,
    context: "keryx pipeline run",
  });
  const receipt = await adapter.awaitGap(gap.gap.id);
  if (receipt) {
    currentEvidence.push(...adapter.mergeEvidence(receipt, detection.targetClaim));
    // re-run coverage analysis, continue answer
  }
}
```

The adapter performs a deliberately simple coverage estimate; Keryx (or any
consumer) should substitute its own coverage model while keeping the same
`detectGap -> openGap -> awaitGap -> mergeEvidence` flow.
