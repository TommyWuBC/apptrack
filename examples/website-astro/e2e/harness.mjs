/**
 * Lightweight static harness for Playwright SDK e2e (no Astro build required).
 * Serves sdk.js + demo HTML and records ingest POSTs.
 */
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sdkPath = join(root, "../../packages/analytics-sdk/dist/sdk.js");
const port = Number(process.env.E2E_PORT ?? 4321);

/** @type {Array<{ body: string, headers: Record<string, string|string[]|undefined> }>} */
const captured = [];

function html(title, body, { srcQuery = "" } = {}) {
  const siteKey = "pk_e2e_demo_site_key";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <script defer src="/sdk.js" data-site-key="${siteKey}" data-mode="full"></script>
</head>
<body>
  ${body}
  <script>
    document.getElementById("spa")?.addEventListener("click", (e) => {
      e.preventDefault();
      history.pushState({}, "", "/projects");
      document.getElementById("view").textContent = "SPA projects";
      document.getElementById("view").setAttribute("data-testid", "spa-projects-view");
    });
    document.getElementById("track-gh")?.addEventListener("click", () => {
      window.apptrack?.track("github_click", { href: "https://github.com/example" });
      window.apptrack?.flush();
    });
  </script>
</body>
</html>`;
}

const home = html(
  "Home",
  `<main data-testid="home-page">
    <h1>Demo</h1>
    <div id="view" data-testid="spa-view">Home</div>
    <a href="#" id="spa" data-testid="spa-nav">SPA Projects</a>
    <button id="track-gh" data-testid="github-click">GitHub</button>
  </main>`,
);

const projects = html(
  "Projects",
  `<main data-testid="projects-page"><h1>Projects</h1></main>`,
);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (req.method === "POST" && url.pathname === "/api/v1/analytics/events") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      captured.push({ body, headers: req.headers });
      res.writeHead(202, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(JSON.stringify({ ok: true, received: captured.length }));
    });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/__e2e/captured") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(captured.map((c) => JSON.parse(c.body))));
    return;
  }

  if (url.pathname === "/__e2e/reset") {
    captured.length = 0;
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/sdk.js") {
    if (!existsSync(sdkPath)) {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("sdk.js missing — build @apptrack/analytics-sdk first");
      return;
    }
    res.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    res.end(readFileSync(sdkPath));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(home);
    return;
  }

  if (url.pathname === "/projects") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(projects);
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.info(`e2e harness on http://127.0.0.1:${port}`);
});
