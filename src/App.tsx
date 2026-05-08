import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { ThemeProvider } from "@/theme/ThemeProvider";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import PageLoadingSkeleton from "./components/ui/PageLoadingSkeleton";
import ScrollToTop from "./components/routing/ScrollToTop";
import { usePageTracking } from "./hooks/usePageTracking";
import { lazy, Suspense, createElement, useEffect } from "react";
import GatedRoute from "./routes/GatedRoute";
import { DASHBOARD_ROUTES, DashboardIndexElement } from "./routes/dashboard-routes";
import { prefetchRoute } from "./lib/perf";

/* ─── Route-level lazy imports ─── */
const Index = lazy(() => import("./pages/Index"));
const ModulePage = lazy(() => import("./pages/ModulePage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const SLA = lazy(() => import("./pages/SLA"));
const PublicPaymentPage = lazy(() => import("./pages/PublicPaymentPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const Admin = lazy(() => import("./pages/Admin"));
const PlatformAdminRoute = lazy(() => import("./components/admin/PlatformAdminRoute"));

const RtlLab = lazy(() => import("./pages/RtlLab"));
const DebugPerf = lazy(() => import("./pages/DebugPerf"));
const DebugEntitlements = lazy(() => import("./pages/DebugEntitlements"));
const DebugFeatureGates = lazy(() => import("./pages/DebugFeatureGates"));
const DebugPaymentProviders = lazy(() => import("./pages/DebugPaymentProviders"));
const DebugWebhooks = lazy(() => import("./pages/DebugWebhooks"));
const DebugWebhookTest = lazy(() => import("./pages/DebugWebhookTest"));
const DebugWorkflows = lazy(() => import("./pages/DebugWorkflows"));
const DebugAccessMap = lazy(() => import("./pages/DebugAccessMap"));
const DebugRlsCheck = lazy(() => import("./pages/DebugRlsCheck"));
const DebugSystemAudit = lazy(() => import("./pages/DebugSystemAudit"));


// Cost-optimised defaults: reduce duplicate fetches → fewer DB hits & lower Cloud spend.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — most ERP data is not real-time
      gcTime: 10 * 60 * 1000,          // 10 min cache retention
      refetchOnWindowFocus: false,      // huge cost saver on tab switching
      refetchOnReconnect: "always",
      retry: 1,                          // avoid retry storms on errors
    },
    mutations: {
      retry: 0,
    },
  },
});

/* ─── Page transition skeleton ─── */
const PageSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageTransitionSkeleton />}>
    {children}
  </Suspense>
);

const PageTransitionSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoadingSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const DebugSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}>
    {children}
  </Suspense>
);

const PageTracker = () => { usePageTracking(); return null; };

const KeyedElement = ({ Component, embedded }: { Component: React.LazyExoticComponent<any>; embedded?: boolean }) => {
  const location = useLocation();
  return createElement(Component, { key: location.pathname, ...(embedded ? { embedded: true } : {}) });
};

/* ─── Prefetch critical routes on idle ─── */
const usePrefetchCriticalRoutes = () => {
  useEffect(() => {
    prefetchRoute(() => import("./pages/Index"));
    prefetchRoute(() => import("./pages/Auth"));
    prefetchRoute(() => import("./pages/Dashboard"));
  }, []);
};

const AppRoutes = () => {
  usePrefetchCriticalRoutes();

  return (
    <>
      <ScrollToTop />
      <PageTracker />
      <Routes>
        <Route path="/" element={<PageSuspense><Index /></PageSuspense>} />
        <Route path="/modules/:slug" element={<PageSuspense><ModulePage /></PageSuspense>} />
        <Route path="/auth" element={<PageSuspense><Auth /></PageSuspense>} />
        <Route path="/reset-password" element={<PageSuspense><ResetPassword /></PageSuspense>} />
        <Route path="/privacy" element={<PageSuspense><PrivacyPolicy /></PageSuspense>} />
        <Route path="/terms" element={<PageSuspense><TermsConditions /></PageSuspense>} />
        <Route path="/sla" element={<PageSuspense><SLA /></PageSuspense>} />
        <Route path="/updates" element={<PageSuspense><UpdatesPage /></PageSuspense>} />
        <Route path="/status" element={<PageSuspense><StatusPage /></PageSuspense>} />
        <Route path="/numaxio-pay" element={<Navigate to="/dashboard/numaxio-pay" replace />} />
        <Route path="/numaxio-pay/dashboard" element={<Navigate to="/dashboard/numaxio-pay" replace />} />
        <Route path="/pay/:token" element={<PageSuspense><PublicPaymentPage /></PageSuspense>} />

        {/* ── Phase B: duplicate route redirects ── */}
        <Route path="/dashboard/invoices" element={<Navigate to="/dashboard/billing" replace />} />
        <Route path="/dashboard/governance" element={<Navigate to="/dashboard/enterprise" replace />} />

        {/* ── Phase A deprecation redirects ── */}
        <Route path="/dashboard/system/storage" element={<Navigate to="/admin/system/storage" replace />} />
        <Route path="/dashboard/system/migrations" element={<Navigate to="/admin/system/migrations" replace />} />
        <Route path="/dashboard/system/infrastructure" element={<Navigate to="/admin/system/infrastructure" replace />} />

        {/* ── Dashboard with nested routes ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PageSuspense><Dashboard /></PageSuspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardIndexElement />} />
          {DASHBOARD_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <GatedRoute
                  segment={route.gateSegment ?? route.path.split("/")[0]}
                  module={route.module}
                  permissionKey={route.permissionKey}
                  deniedReason={route.deniedReason as any}
                  isOpenRoute={route.isOpenRoute}
                >
                  {route.keyOnPath || route.embedded ? (
                    <KeyedElement Component={route.element} embedded={route.embedded} />
                  ) : (
                    createElement(route.element)
                  )}
                </GatedRoute>
              }
            />
          ))}
        </Route>

        {/* ── Admin ── */}
        <Route path="/admin" element={<PageSuspense><PlatformAdminRoute><Admin /></PlatformAdminRoute></PageSuspense>} />
        <Route path="/admin/*" element={<PageSuspense><PlatformAdminRoute><Admin /></PlatformAdminRoute></PageSuspense>} />

        {/* ── Debug routes ── */}
        {import.meta.env.DEV && (
          <>
            <Route path="/debug/rtl-lab" element={<PageSuspense><PlatformAdminRoute><RtlLab /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/perf" element={<PageSuspense><PlatformAdminRoute><DebugPerf /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/entitlements" element={<PageSuspense><PlatformAdminRoute><DebugEntitlements /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/feature-gates" element={<PageSuspense><PlatformAdminRoute><DebugFeatureGates /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/access-map" element={<PageSuspense><PlatformAdminRoute><DebugAccessMap /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/rls-check" element={<PageSuspense><PlatformAdminRoute><DebugRlsCheck /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/payment-providers" element={<PageSuspense><PlatformAdminRoute><DebugPaymentProviders /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/webhooks" element={<PageSuspense><PlatformAdminRoute><DebugWebhooks /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/webhook-test" element={<PageSuspense><PlatformAdminRoute><DebugWebhookTest /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/workflows" element={<PageSuspense><PlatformAdminRoute><DebugWorkflows /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/system-audit" element={<PageSuspense><PlatformAdminRoute><DebugSystemAudit /></PlatformAdminRoute></PageSuspense>} />
            <Route path="/debug/rls-verify" element={<Navigate to="/admin/system/rls-verify" replace />} />
          </>
        )}

        <Route path="*" element={<PageSuspense><NotFound /></PageSuspense>} />
      </Routes>
    </>
  );
};

const App = () => (
  <HelmetProvider>
  <GlobalErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <EntitlementsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            </EntitlementsProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </GlobalErrorBoundary>
  </HelmetProvider>
);

export default App;
