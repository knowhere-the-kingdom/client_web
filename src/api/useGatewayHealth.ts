import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createGatewayClient,
  type GatewayHealthStatus,
} from "./gateway-client";
import { configuredGatewayHealthOrigin } from "./gateway-health-config";

export function useGatewayHealth(): readonly [GatewayHealthStatus, () => void] {
  const client = useMemo(() => createGatewayClient(configuredGatewayHealthOrigin()), []);
  const controller = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<GatewayHealthStatus>({ phase: "idle" });

  const refresh = useCallback(() => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setStatus({ phase: "checking" });

    void client.checkHealth(nextController.signal).then((nextStatus) => {
      if (controller.current === nextController) setStatus(nextStatus);
    });
  }, [client]);

  useEffect(() => {
    refresh();
    return () => controller.current?.abort();
  }, [refresh]);

  return [status, refresh] as const;
}
