"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { useAppStore } from "@/lib/store";

/**
 * Handles Supabase email confirmation / magic-link redirects.
 * Configure the same URL in Supabase → Authentication → URL configuration.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your session…");

  useEffect(() => {
    const run = async () => {
      const sb = getSupabaseBrowser();
      if (!sb) {
        setMessage("Supabase is not configured.");
        return;
      }
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        // Hydrate first so we know whether the user has completed onboarding.
        // Routing PKCE callbacks unconditionally to /dashboard caused
        // /dashboard ↔ /onboarding ping-pong (the dashboard layout bounces
        // back when onboardingComplete is false), re-running hydration each
        // time and feeling like a stall.
        await useAppStore.getState().hydrateAuthFromSupabase();
        const done = useAppStore.getState().onboardingComplete;
        router.replace(done ? "/dashboard" : "/onboarding");
        return;
      }
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const p = new URLSearchParams(hash);
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await sb.auth.setSession({ access_token, refresh_token });
          if (error) {
            setMessage(error.message);
            return;
          }
          await useAppStore.getState().hydrateAuthFromSupabase();
          const done = useAppStore.getState().onboardingComplete;
          router.replace(done ? "/dashboard" : "/onboarding");
          return;
        }
      }
      setMessage("This link is invalid or has expired. Request a new one from the sign-in page.");
    };
    void run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f6f4" }}>
      <p className="text-sm font-medium text-center max-w-md" style={{ color: "#6b7c75" }}>
        {message}
      </p>
    </div>
  );
}
