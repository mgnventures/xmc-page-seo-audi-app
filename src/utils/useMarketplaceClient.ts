// src/utils/useMarketplaceClient.ts
import { useEffect, useState, useMemo } from "react";
import { ClientSDK, type ApplicationContext } from "@sitecore-marketplace-sdk/client";
// If you plan to call XM Cloud APIs later, also:
// import { XMC } from "@sitecore-marketplace-sdk/xmc";

type State = {
  client: ClientSDK | null;
  app?: ApplicationContext;
  ready: boolean;
  error?: Error;
};

export function useMarketplaceClient() {
  const [state, setState] = useState<State>({ client: null, ready: false });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const client = await ClientSDK.init({
          target: window.parent,
          // modules: [XMC], // enable when you use XM Cloud APIs
        });
        // Pull app context (contains IDs, extension points, tenant/site context IDs)
        const res = await client.query("application.context");
        if (!mounted) return;
        setState({ client, app: res.data as ApplicationContext, ready: true });
      } catch (e: any) {
        if (mounted) setState({ client: null, ready: false, error: e });
      }
    })();
    return () => { mounted = false; };
  }, []);

  return useMemo(() => state, [state]);
}
