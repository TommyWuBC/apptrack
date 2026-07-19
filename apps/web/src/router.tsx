import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "./components/AppShell.js";
import { OverviewPage } from "./routes/OverviewPage.js";
import { ApplicationsPage } from "./routes/ApplicationsPage.js";
import { ApplicationDetailPage } from "./routes/ApplicationDetailPage.js";
import { CompaniesPage } from "./routes/CompaniesPage.js";
import { StatsPage } from "./routes/StatsPage.js";
import { SettingsPage } from "./routes/SettingsPage.js";
import { ReviewPage } from "./routes/ReviewPage.js";
import { AuthPage } from "./routes/AuthPage.js";
import { api } from "./api/client.js";

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const demo = api.isDemo();
  const authRoute = pathname === "/login" || pathname === "/setup";
  const status = useQuery({
    queryKey: ["auth-status"],
    queryFn: api.authStatus,
    enabled: !demo && !authRoute,
    retry: false,
  });
  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: api.me,
    enabled: !demo && !authRoute && status.isSuccess && !status.data.setupRequired,
    retry: false,
  });

  if (authRoute) return <Outlet />;
  if (!demo && status.isLoading) return <p className="p-6">Checking setup…</p>;
  if (!demo && status.data?.setupRequired) return <AuthPage mode="setup" />;
  if (!demo && (status.error || me.error)) return <AuthPage mode="login" />;
  if (!demo && me.isLoading) return <p className="p-6">Loading session…</p>;
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

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => <AuthPage mode="login" />,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: () => <AuthPage mode="setup" />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  applicationsRoute,
  applicationDetailRoute,
  reviewRoute,
  companiesRoute,
  statsRoute,
  settingsRoute,
  loginRoute,
  setupRoute,
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
