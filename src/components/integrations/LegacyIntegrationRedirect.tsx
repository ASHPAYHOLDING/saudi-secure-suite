/**
 * LegacyIntegrationRedirect
 * يحوّل المسارات القديمة إلى المسار الموحّد:
 * /dashboard/integrations/payment/tap → /dashboard/integrations/tap
 * /dashboard/integrations/provider/stripe → /dashboard/integrations/stripe
 */
import { Navigate, useParams, useLocation } from "react-router-dom";

const LegacyIntegrationRedirect = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  // آخر segment هو دائماً providerId
  const providerId = segments[segments.length - 1] || "";
  return <Navigate to={`/dashboard/integrations/${providerId}`} replace />;
};

export default LegacyIntegrationRedirect;
