"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { useAppStore } from "@/lib/store";

/**
 * Shown after the user follows the password reset link from email.
 * Supabase must redirect to this route (set in resetPasswordForEmail + Supabase URL config).
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState(() => (getSupabaseBrowser() ? "" : "Supabase is not configured."));
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Checking your reset link…");

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      return;
    }
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setStatus("Reset link verified.");
      }
    });
    void sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        setStatus("Reset link verified.");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use 8 characters or more.");
      return;
    }
    if (password !== password2) {
      setError("The two passwords don't match.");
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) return;
    setLoading(true);
    setStatus("Updating your password…");
    const { error: upErr } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      setStatus("Reset link verified.");
      setError(upErr.message);
      return;
    }
    await useAppStore.getState().hydrateAuthFromSupabase();
    const done = useAppStore.getState().onboardingComplete;
    setStatus("Redirecting…");
    router.replace(done ? "/dashboard" : "/onboarding");
  };

  if (!getSupabaseBrowser()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f6f4" }}>
        <p className="text-sm" style={{ color: "#6b7c75" }}>Supabase is not configured.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12" style={{ background: "#f4f6f4" }}>
      <div className="bg-white rounded-3xl w-full p-8 shadow-sm" style={{ maxWidth: 420, border: "1.5px solid rgba(0,0,0,0.07)" }}>
        <h1 className="font-headline font-extrabold text-xl mb-1" style={{ color: "#1a1f1e" }}>Set a new password.</h1>
        <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
          {ready ? "Use 8 characters or more." : status}
        </p>
        {!ready && (
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold" style={{ color: "#6b7c75" }}>
            <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "#006c4a" }} />
            {status}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: "#6b7c75" }}>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid rgba(0,0,0,0.1)", background: "#fafcfb" }}
              disabled={!ready || loading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: "#6b7c75" }}>Confirm new password</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid rgba(0,0,0,0.1)", background: "#fafcfb" }}
              disabled={!ready || loading}
            />
          </div>
          {error && <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>{error}</p>}
          <button
            type="submit"
            disabled={!ready || loading}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: ready && !loading ? "#006c4a" : "#8ab5a0" }}
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
