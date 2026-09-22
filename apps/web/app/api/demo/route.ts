import { API_BASE } from "../../../lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${API_BASE}/api/demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: body.scenario }),
      signal: AbortSignal.timeout(15000),
    });
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json(
      { error: "The demo service is unavailable. Please retry when it is online." },
      { status: 503 },
    );
  }
}
