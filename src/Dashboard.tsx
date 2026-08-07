import type { GatewaySessionProjection } from "./api/gateway-contract.ts";
import { DesignerWorkspace } from "./designer-dashboard/DesignerWorkspace.tsx";

export function Dashboard({ projection, onBack, onLogout }: Readonly<{
  projection: GatewaySessionProjection;
  onBack: () => void;
  onLogout: () => void;
}>) {
  const authorization = projection.session.authorization.revision === projection.session.authorizationRevision
    ? projection.session.authorization
    : null;
  return <DesignerWorkspace projection={projection} authorization={authorization} onBack={onBack} onLogout={onLogout} />;
}
