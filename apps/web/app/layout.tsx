import type { Metadata } from "next";
import "./globals.css";
import { EnvBanner } from "../components/env-banner";

export const metadata: Metadata = {
  title: "Gap402 — The missing-knowledge market for AI agents",
  description:
    "When an AI agent cannot find the answer, it creates a market for one. Evidence bounties settled in USDC on Arc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EnvBanner />
        <header className="site">
          <div className="container row">
            <h1>
              <a href="/" style={{ color: "inherit" }}>
                gap402
              </a>
            </h1>
            <nav>
              <a href="/">market</a>
              <a href="/gaps">gaps</a>
              <a href="/receipts">receipts</a>
              <a href="https://github.com/tang-vu/gap402">github</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site">
          <div className="container">
            gap402 — turn uncertainty into a market · evidence bounties in USDC on Arc ·
            MIT
          </div>
        </footer>
      </body>
    </html>
  );
}
