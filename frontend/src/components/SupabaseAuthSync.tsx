"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { clearSessionId } from "@/lib/session";
import { useAppStore } from "@/lib/store";

const DEMO_ID = "user-demo";

/**
 * On load: restore Supabase session into the Zustand store.
 * On auth events: keep the store aligned (e.g. sign-out in another tab).
 */
export function SupabaseAuthSync() {
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      useAppStore.setState({ authReady: true });
      return;
    }

    void useAppStore.getState().hydrateAuthFromSupabase();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void (async () => {
          const {
            data: { session: liveSession },
          } = await sb.auth.getSession();
          if (liveSession?.user?.email) {
            return;
          }
          const cur = useAppStore.getState().currentUser;
          if (cur && cur.id !== DEMO_ID) {
            clearSessionId(cur.id);
            useAppStore.setState({
              currentUser: null,
              sessionId: null,
              backendReady: false,
              workspaceHydrating: false,
              syncError: null,
            });
          }
          useAppStore.setState({ authReady: true });
        })();
        return;
      }
      if (session?.user?.email && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        void useAppStore.getState().hydrateAuthFromSupabase();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
