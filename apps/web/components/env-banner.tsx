import { api } from "../lib/api";

/** Environment banner — LOCAL / ARC TESTNET / ARC MAINNET. Always visible. */
export async function EnvBanner() {
  let health = null;
  try {
    health = await api.health();
  } catch {
    /* API down — banner still renders */
  }
  const network = health?.network ?? "unknown";
  const label =
    network === "mainnet"
      ? "ARC MAINNET"
      : network === "testnet"
        ? "ARC TESTNET"
        : network === "local"
          ? "LOCAL"
          : "NETWORK UNKNOWN";
  return (
    <div className={`banner ${network}`}>
      <span className="dot" />
      <span>{label}</span>
      {health ? (
        <span>
          {health.settlementMode} · verifier {health.verificationMode}
        </span>
      ) : null}
      {health?.chainId ? <span>chain {health.chainId}</span> : null}
      {health?.bountyContract ? (
        <span>
          contract{" "}
          {health.explorer ? (
            <a href={`${health.explorer}/address/${health.bountyContract}`}>
              {health.bountyContract.slice(0, 10)}…
            </a>
          ) : (
            health.bountyContract.slice(0, 14)
          )}
        </span>
      ) : (
        <span>contract —</span>
      )}
      {!health ? <span>api offline</span> : null}
    </div>
  );
}
