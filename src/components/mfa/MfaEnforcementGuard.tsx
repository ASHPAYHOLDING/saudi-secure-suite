import { type ReactNode } from "react";

interface MfaEnforcementGuardProps {
  children: ReactNode;
}

const MfaEnforcementGuard = ({ children }: MfaEnforcementGuardProps) => {
  return <>{children}</>;
};

export default MfaEnforcementGuard;
