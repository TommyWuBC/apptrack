import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell.js";
import { OverviewPage } from "./routes/OverviewPage.js";
import { ApplicationsPage } from "./routes/ApplicationsPage.js";
import { ApplicationDetailPage } from "./routes/ApplicationDetailPage.js";
import { CompaniesPage } from "./routes/CompaniesPage.js";
import { StatsPage } from "./routes/StatsPage.js";
import { SettingsPage } from "./routes/SettingsPage.js";
import { ReviewPage } from "./routes/ReviewPage.js";

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell pathname={pathname}>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});

const applicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications",
  component: ApplicationsPage,
});

const applicationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications/$id",
  component: ApplicationDetailPage,
});

const companiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/companies",
  component: CompaniesPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: ReviewPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  applicationsRoute,
  applicationDetailRoute,
  reviewRoute,
  companiesRoute,
  statsRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
