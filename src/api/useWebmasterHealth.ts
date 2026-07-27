import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createWebmasterClient,
  type WebmasterHealthStatus,
} from "./webmaster-client";

function configuredWebmasterUrl(): URL {
  const configured = document.querySelector<HTMLMetaElement>('meta[name="knowhere-webmaster-url"]')?.content.trim();
  return new URL(configured || window.location.origin);
}

export function useWebmasterHealth(): readonly [WebmasterHealthStatus, () => void] {
  const client = useMemo(() => createWebmasterClient(configuredWebmasterUrl()), []);
  const controller = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<WebmasterHealthStatus>({ phase: "idle" });

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
