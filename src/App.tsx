import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EntitlementsProvider } from "@/contexts/EntitlementsContext";
import { ThemeProvider } from "@/theme/ThemeProvider";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import PageLoadingSkeleton from "./components/ui/PageLoadingSkeleton";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ScrollToTop from "./components/ScrollToTop";
import TermsConditions from "./pages/TermsConditions";
import SLA from "./pages/SLA";
import StatusPage from "./pages/StatusPage";
import Admin from "./pages/Admin";
import PlatformAdminRoute from "./components/admin/PlatformAdminRoute";
import { lazy, Suspense, createElement } from "react";
import GatedRoute from "./routes/GatedRoute";
import { DASHBOARD_ROUTES, DashboardIndexElement } from "./routes/dashboard-routes";

const RtlLab = lazy(() => import("./pages/RtlLab"));
const DebugPerf = lazy(() => import("./pages/DebugPerf"));
const DebugEntitlements = lazy(() => import("./pages/DebugEntitlements"));
const DebugFeatureGates = lazy(() => import("./pages/DebugFeatureGates"));
const DebugPaymentProviders = lazy(() => import("./pages/DebugPaymentProviders"));
const DebugWebhooks = lazy(() => import("./pages/DebugWebhooks"));
const DebugWebhookTest = lazy(() => import("./pages/DebugWebhookTest"));

const queryClient = new QueryClient();

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

/** Wrapper that passes key={pathname} for routes that need remount on path change */
const KeyedElement = ({ Component, embedded }: { Component: React.LazyExoticComponent<any>; embedded?: boolean }) => {
  const location = useLocation();
  return createElement(Component, { key: location.pathname, ...(embedded ? { embedded: true } : {}) });
};

const App = () => (
  <GlobalErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <EntitlementsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsConditions />} />
                <Route path="/sla" element={<SLA />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/numaxio-pay" element={<Navigate to="/dashboard/numaxio-pay" replace />} />
                <Route path="/numaxio-pay/dashboard" element={<Navigate to="/dashboard/numaxio-pay" replace />} />

                {/* ── Dashboard with nested routes ── */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                >
                  {/* Index route */}
                  <Route index element={<DashboardIndexElement />} />

                  {/* All dashboard child routes — generated from config */}
                  {DASHBOARD_ROUTES.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={
                        <GatedRoute
                          segment={route.gateSegment || ""}
                          module={route.module}
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
                <Route path="/admin" element={<PlatformAdminRoute><Admin /></PlatformAdminRoute>} />
                <Route path="/admin/*" element={<PlatformAdminRoute><Admin /></PlatformAdminRoute>} />

                {/* ── Debug routes ── */}
                <Route path="/debug/rtl-lab" element={<ProtectedRoute><DebugSuspense><RtlLab /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/perf" element={<ProtectedRoute><DebugSuspense><DebugPerf /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/entitlements" element={<ProtectedRoute><DebugSuspense><DebugEntitlements /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/feature-gates" element={<ProtectedRoute><DebugSuspense><DebugFeatureGates /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/payment-providers" element={<ProtectedRoute><DebugSuspense><DebugPaymentProviders /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/webhooks" element={<ProtectedRoute><DebugSuspense><DebugWebhooks /></DebugSuspense></ProtectedRoute>} />
                <Route path="/debug/webhook-test" element={<ProtectedRoute><DebugSuspense><DebugWebhookTest /></DebugSuspense></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </EntitlementsProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </GlobalErrorBoundary>
);

export default App;
