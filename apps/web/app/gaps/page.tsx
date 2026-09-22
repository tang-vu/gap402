import { api } from "../../lib/api";
import { MarketRegister } from "../../components/market-register";
export const dynamic = "force-dynamic";
export default async function GapsPage() {
  const { gaps } = await api.listGaps();
  return (
    <main id="main" className="container">
      <section className="hero register-hero">
        <div className="tagline">The evidence exchange / Market register</div>
        <h1>
          Open questions.
          <br />
          <em>Explicit terms.</em>
        </h1>
        <p className="sub">
          A register of claims, the evidence they need, and the budget behind each
          request. Funding is shown only when a transaction is recorded.
        </p>
      </section>
      <section className="block">
        <MarketRegister gaps={gaps} />
      </section>
    </main>
  );
}
