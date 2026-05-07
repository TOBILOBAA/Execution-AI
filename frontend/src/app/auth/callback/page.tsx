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
  const [message, setMessage] = useState("Verifying your sign-in link…");
  const [step, setStep] = useState("Checking the link");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setMessage((m) => (m === "Verifying your sign-in link…" ? "Still working. One moment." : m));
    }, 6000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const run = async () => {
      const sb = getSupabaseBrowser();
      if (!sb) {
        setMessage("Could not sign you in. Head back to sign in and try again.");
        return;
      }
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        setStep("Exchanging the secure code");
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        setStep("Restoring your workspace");
        setMessage("Signing you in…");
        await useAppStore.getState().hydrateAuthFromSupabase();
        const done = useAppStore.getState().onboardingComplete;
        setStep("Redirecting");
        router.replace(done ? "/dashboard" : "/onboarding");
        return;
      }
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const p = new URLSearchParams(hash);
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          setStep("Restoring your workspace");
          setMessage("Signing you in…");
          const { error } = await sb.auth.setSession({ access_token, refresh_token });
          if (error) {
            setMessage(error.message);
            return;
          }
          await useAppStore.getState().hydrateAuthFromSupabase();
          const done = useAppStore.getState().onboardingComplete;
          setStep("Redirecting");
          router.replace(done ? "/dashboard" : "/onboarding");
          return;
        }
      }
      setMessage("Could not sign you in. Head back to sign in and try again.");
    };
    void run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f6f4" }}>
      <div
        className="w-full max-w-md rounded-3xl bg-white px-7 py-8 text-center"
        style={{ border: "1.5px solid rgba(0,0,0,0.07)", boxShadow: "0 10px 32px rgba(0,0,0,0.05)" }}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}>
          <span className="material-symbols-outlined text-[22px]">bolt</span>
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
          {step}
        </p>
        <p className="mt-3 text-sm font-medium text-center max-w-md mx-auto" style={{ color: "#6b7c75" }}>
          {message}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={index}
              className="h-2.5 w-2.5 rounded-full animate-pulse"
              style={{ background: index === 1 ? "#006c4a" : "rgba(0,108,74,0.22)", animationDelay: `${index * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
