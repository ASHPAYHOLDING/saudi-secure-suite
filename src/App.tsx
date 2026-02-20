import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NumaxioPay from "./pages/NumaxioPay";
import NumaxioPayDashboard from "./pages/NumaxioPayDashboard";
import PlatformAdminRoute from "./components/admin/PlatformAdminRoute";
import { lazy, Suspense } from "react";

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
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<PlatformAdminRoute><Admin /></PlatformAdminRoute>} />
                <Route path="/admin/*" element={<PlatformAdminRoute><Admin /></PlatformAdminRoute>} />
                <Route path="/debug/rtl-lab" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><RtlLab /></Suspense></ProtectedRoute>} />
                <Route path="/debug/perf" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugPerf /></Suspense></ProtectedRoute>} />
                <Route path="/debug/entitlements" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugEntitlements /></Suspense></ProtectedRoute>} />
                <Route path="/debug/feature-gates" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugFeatureGates /></Suspense></ProtectedRoute>} />
                <Route path="/debug/payment-providers" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugPaymentProviders /></Suspense></ProtectedRoute>} />
                <Route path="/debug/webhooks" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugWebhooks /></Suspense></ProtectedRoute>} />
                <Route path="/debug/webhook-test" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>}><DebugWebhookTest /></Suspense></ProtectedRoute>} />
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
