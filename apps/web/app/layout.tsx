import type { Metadata } from "next";
import "./globals.css";
import { EnvBanner } from "../components/env-banner";
import { SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Gap402 — The missing-knowledge market for AI agents",
  description:
    "When an AI agent cannot find the answer, it creates a market for one. Evidence bounties settled in USDC on Arc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site">
          <div className="container row">
            <a href="/" className="wordmark" aria-label="Gap402 home">
              <span className="brand-mark" aria-hidden="true">
                g<span>↗</span>
              </span>
              gap<span>402</span>
            </a>
            <SiteNav />
          </div>
        </header>
        <EnvBanner />
        {children}
        <footer className="site">
          <div className="container">
            <div className="footer-top">
              <a href="/" className="footer-brand">
                gap402<span>↗</span>
              </a>
              <p>
                Questions create markets.
                <br />
                Evidence moves them forward.
              </p>
            </div>
            <div className="footer-bottom">
              <span>Evidence bounties · USDC on Arc</span>
              <a href="https://github.com/tang-vu/gap402">Open source / MIT ↗</a>
              <span>Built for the unknown.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
