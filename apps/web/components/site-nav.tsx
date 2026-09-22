"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SiteNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation">
      {(
        [
          ["/gaps", "Market"],
          ["/receipts", "Receipts"],
          ["/verify", "Verify proof"],
        ] as const
      ).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path.startsWith(href) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      <Link
        className="nav-lab"
        href="/lab"
        aria-current={path === "/lab" ? "page" : undefined}
      >
        Enter the lab <span aria-hidden="true">↗</span>
      </Link>
    </nav>
  );
}
