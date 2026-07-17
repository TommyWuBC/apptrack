/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-no-db",
      severity: "error",
      comment: "packages/core must never import packages/db (AGENTS.md §9)",
      from: { path: "(^|/)packages/core/" },
      to: { path: "(packages/db|@apptrack/db)" },
    },
    {
      name: "core-no-providers",
      severity: "error",
      comment: "packages/core must never import packages/providers",
      from: { path: "(^|/)packages/core/" },
      to: { path: "(packages/providers|@apptrack/providers)" },
    },
    {
      name: "core-no-apps",
      severity: "error",
      comment: "packages/core must never import apps",
      from: { path: "(^|/)packages/core/" },
      to: { path: "(^|/)apps/" },
    },
    {
      name: "db-no-core",
      severity: "error",
      comment: "packages/db must never import packages/core",
      from: { path: "(^|/)packages/db/" },
      to: { path: "(packages/core|@apptrack/core)" },
    },
    {
      name: "web-no-server-internals",
      severity: "error",
      comment: "web may only consume shared types + REST API",
      from: { path: "(^|/)apps/web/" },
      to: {
        path: "(apps/server|apps/worker|packages/core|packages/db|packages/providers|@apptrack/core|@apptrack/db|@apptrack/providers)",
      },
    },
    {
      name: "no-googleapis-outside-providers",
      severity: "error",
      comment: "R-2: googleapis only inside packages/providers",
      from: { pathNot: "(^|/)packages/providers/" },
      to: { path: "(node_modules/googleapis|^googleapis$)" },
    },
    {
      name: "no-circular",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    // Include unresolved / workspace package names so @apptrack/* imports are ruled
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
