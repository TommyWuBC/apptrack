import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import type { ReactNode } from "react";
import { api } from "../api/client.js";

const links = [
  { to: "/", label: "Overview" },
  { to: "/applications", label: "Applications" },
  { to: "/review", label: "Review" },
  { to: "/companies", label: "Companies" },
  { to: "/stats", label: "Stats" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const demo = api.isDemo();
  return (
    <div className="app-shell">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink-900/10 pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-moss-600">
            self-hosted
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-950">
            apptrack
          </h1>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="Primary">
          {links.map((l) => {
            const active =
              l.to === "/"
                ? pathname === "/"
                : pathname === l.to || pathname.startsWith(`${l.to}/`);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={clsx("nav-link", active && "nav-link-active")}
              >
                {l.label}
              </Link>
            );
          })}
          {!demo ? (
            <button
              type="button"
              className="nav-link"
              onClick={() => {
                void api.logout().finally(() => window.location.assign("/login"));
              }}
            >
              Sign out
            </button>
          ) : null}
        </nav>
      </header>
      {demo ? (
        <p
          className="mb-4 rounded border border-citrus-400/40 bg-citrus-400/15 px-3 py-2 text-sm text-ink-800"
          data-testid="demo-banner"
        >
          Demo fixtures — add <code className="font-mono">?demo=1</code> (or{" "}
          <code className="font-mono">VITE_DEMO=1</code>) for offline UI. Analytics
          settings are available under Settings.
        </p>
      ) : null}
      <div className="flex-1">{children}</div>
    </div>
  );
}
