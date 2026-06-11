"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { describeSyncError } from "@/lib/apiErrors";
import { isAuthLocalOnly, isCloudPasswordAuthEnabled, isCloudSupabaseConfigured } from "@/lib/authMode";
import { PASSWORD_REQUIREMENTS_COPY, validateStrongPassword } from "@/lib/passwordRules";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

type Mode = "signin" | "signup" | "forgot" | "verify-email";

const cloudPassword = isCloudPasswordAuthEnabled();
const authLocalOnly = isAuthLocalOnly();

/** Format check only — does not verify the inbox exists or accepts mail. */
const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export default function AuthPage() {
  const router = useRouter();
  const {
    currentUser,
    signIn,
    signUp,
    sendPasswordReset,
    hydrateAuthFromSupabase,
    onboardingComplete,
    authReady,
    backendReady,
    workspaceHydrating,
    syncError,
  } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      signIn: state.signIn,
      signUp: state.signUp,
      sendPasswordReset: state.sendPasswordReset,
      hydrateAuthFromSupabase: state.hydrateAuthFromSupabase,
      onboardingComplete: state.onboardingComplete,
      authReady: state.authReady,
      backendReady: state.backendReady,
      workspaceHydrating: state.workspaceHydrating,
      syncError: state.syncError,
    })),
  );
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryingWorkspace, setRetryingWorkspace] = useState(false);
  const serverPersistenceRequired = isCloudSupabaseConfigured() && !isAuthLocalOnly();
  const backendAttachFailed =
    Boolean(currentUser) &&
    serverPersistenceRequired &&
    !workspaceHydrating &&
    !backendReady &&
    Boolean(syncError);

  useEffect(() => {
    if (!authReady || workspaceHydrating || !currentUser) {
      return;
    }
    if (serverPersistenceRequired && !backendReady) {
      return;
    }
    router.replace(onboardingComplete ? "/dashboard" : "/onboarding");
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, router, serverPersistenceRequired]);

  const handingOffToWorkspace = Boolean(currentUser);

  const retryWorkspaceConnection = async () => {
    setRetryingWorkspace(true);
    try {
      await hydrateAuthFromSupabase();
    } finally {
      setRetryingWorkspace(false);
    }
  };

  if (backendAttachFailed) {
    const { title, message, footer } = describeSyncError(syncError ?? "");
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f6f4" }}>
        <div
          className="w-full max-w-md rounded-3xl px-7 py-8 bg-white"
          style={{ boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)" }}
        >
          <p
            className="text-[10px] uppercase tracking-widest font-bold mb-3"
            style={{ color: "#a8b5af" }}
          >
            Workspace connection
          </p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-3" style={{ color: "#1a1f1e" }}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "#475569" }}>
            {message}
          </p>
          <p className="text-xs leading-relaxed mb-6" style={{ color: "#64748b" }}>
            {footer}
          </p>
          <button
            type="button"
            onClick={() => void retryWorkspaceConnection()}
            disabled={retryingWorkspace}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#006c4a" }}
          >
            {retryingWorkspace ? "Retrying…" : "Retry connection"}
          </button>
        </div>
      </div>
    );
  }

  if (!authReady || workspaceHydrating || handingOffToWorkspace) {
    return (
      <AppLoadingScreen
        eyebrow={handingOffToWorkspace ? "Preparing your execution engine" : "Loading authentication"}
        title={handingOffToWorkspace ? "Opening your next step" : "Checking your sign-in state"}
        detail={
          handingOffToWorkspace
            ? "We are restoring your session, syncing your latest planning data, and routing you to the right workspace."
            : "We are checking your local or cloud session before showing the right auth state."
        }
      />
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
    if (m !== "verify-email") {
      setName("");
      setEmail("");
      setPassword("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (mode === "verify-email") {
      switchMode("signin");
      return;
    }

    if (mode === "forgot") {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        setError("Enter your email.");
        return;
      }
      if (!EMAIL_FORMAT.test(trimmedEmail)) {
        setError("That doesn't look like a valid email.");
        return;
      }
      setLoading(true);
      const r = await sendPasswordReset(trimmedEmail);
      setLoading(false);
      if (!r.success) {
        setError(r.error ?? "Could not send reset email.");
        return;
      }
      setInfo("Check your inbox. The reset link is good for 1 hour.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your email.");
      return;
    }
    if (!EMAIL_FORMAT.test(trimmedEmail)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name before continuing.");
      return;
    }
    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);

    if (mode === "signin") {
      const result = await signIn(trimmedEmail, password);
      if (!result.success) {
        setError(result.error ?? "Sign in failed.");
        setLoading(false);
        return;
      }
    } else {
      const result = await signUp(name.trim(), trimmedEmail, password);
      if (!result.success) {
        setError(result.error ?? "Sign up failed.");
        setLoading(false);
        return;
      }
      if (result.needsEmailConfirmation) {
        setMode("verify-email");
        setInfo("We sent a verification link to your inbox. Open it to verify your account and continue to onboarding.");
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  };

  const heading =
    mode === "forgot"
      ? "Reset your password."
      : mode === "verify-email"
        ? "Verify your email."
        : mode === "signin"
          ? "Welcome back."
          : "Start your execution system.";

  const subline =
    mode === "forgot"
      ? "Enter the email linked to your account and we'll send a secure reset link."
      : mode === "verify-email"
        ? `We sent a secure verification link to ${email.trim() || "your email"}. Open it to confirm your account and continue into onboarding.`
        : mode === "signup"
          ? "Create your account to connect yearly goals to daily action and start seeing what is helping your growth or causing drift."
          : cloudPassword
            ? "Step back into your yearly plan, protect today's main goal, and keep your progress moving."
            : authLocalOnly
              ? "Sign in with your local account to continue."
              : "Sign in with your email and password.";

  const submitLabel = () => {
    if (mode === "forgot") return "Send reset link";
    if (mode === "verify-email") return "Back to sign in";
    return mode === "signup" ? "Create account" : "Sign in";
  };

  const loadingLabel = () => {
    if (mode === "forgot") return "Sending…";
    if (mode === "signup") return "Creating your account…";
    return "Signing in…";
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#f4f6f4" }}>
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12" style={{ background: "#0d1f18" }}>
        <div className="flex items-center gap-3">
          <p className="font-headline text-[30px] font-extrabold tracking-[-0.05em] text-white">Execution AI</p>
          <BetaBadge compact light className="translate-y-px" />
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#85f8c4" }}>
              Built for intentional growth
            </p>
            <h1
              className="font-headline font-extrabold leading-tight"
              style={{ fontSize: "40px", color: "#fff", lineHeight: 1.15 }}
            >
              See what is helping
              <br />
              your growth.
              <br />
              <span style={{ color: "#85f8c4" }}>See what is causing drift.</span>
            </h1>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Execution AI connects yearly goals to daily action so you can see what is moving progress, what is slowing it down,
            and what to adjust next.
          </p>

          <div className="flex flex-wrap gap-2">
            {["Year-to-day alignment", "Behavior insights", "Weekly correction", "Progress visibility"].map((f) => (
              <span
                key={f}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}
              >
                {f}
              </span>
            ))}
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm italic leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
              &ldquo;I thought I was staying busy, but my real yearly goal was barely moving. Execution AI made that gap obvious
              and helped me plan with more intention.&rdquo;
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: "#006c4a" }}
              >
                S
              </div>
              <div>
                <p className="text-xs font-bold text-white">Nina O.</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Solopreneur · Early access
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          © 2026 Execution AI · All rights reserved
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <p className="font-headline text-[26px] font-extrabold tracking-[-0.05em]" style={{ color: "#1a1f1e" }}>
            Execution AI
          </p>
          <BetaBadge compact className="translate-y-px" />
        </div>

        <div className="bg-white rounded-3xl shadow-sm w-full" style={{ maxWidth: 460, border: "1.5px solid rgba(0,0,0,0.07)" }}>
          {mode !== "verify-email" && (
            <div className="flex p-1.5 m-5 mb-0 rounded-2xl" style={{ background: "#f4f6f4" }}>
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all"
                  style={{
                    background: mode === m ? "#fff" : "transparent",
                    color: mode === m ? "#1a1f1e" : "#8a9e97",
                    boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>
          )}

          <div className="p-7 pt-6">
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="mb-4 inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-70"
                style={{ color: "#006c4a" }}
              >
                <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                Back to sign in
              </button>
            )}

            <div className="mb-6">
              <h2 className="font-headline font-extrabold text-2xl mb-1" style={{ color: "#1a1f1e" }}>
                {heading}
              </h2>
              <p className="text-sm" style={{ color: "#8a9e97" }}>
                {subline}
              </p>
            </div>

            {mode === "verify-email" ? (
              <div className="space-y-4">
                {info && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(0,108,74,0.07)", border: "1px solid rgba(0,108,74,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: "#006c4a" }}>
                      mark_email_read
                    </span>
                    <p className="text-xs font-semibold" style={{ color: "#006c4a" }}>
                      {info}
                    </p>
                  </div>
                )}

                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "#f8faf9", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                >
                  Once you open the link in your email, we&rsquo;ll verify your account and sign you in automatically.
                </div>

                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all mt-2"
                  style={{ background: "#006c4a" }}
                >
                  Back to sign in
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "#6b7c75" }}>
                      Name
                    </label>
                    <div className="relative">
                      <span
                        className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]"
                        style={{ color: "#c4d0cb" }}
                      >
                        person
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setError("");
                        }}
                        placeholder="Your full name"
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#1a1f1e", background: "#fafcfb" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,108,74,0.5)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "#6b7c75" }}>
                    Email
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]"
                      style={{ color: "#c4d0cb" }}
                    >
                      mail
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#1a1f1e", background: "#fafcfb" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,108,74,0.5)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "#6b7c75" }}>
                        Password
                      </label>
                      {mode === "signin" && cloudPassword && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-[11px] font-bold transition-opacity hover:opacity-70"
                          style={{ color: "#006c4a" }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span
                        className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]"
                        style={{ color: "#c4d0cb" }}
                      >
                        lock
                      </span>
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                        className="w-full pl-10 pr-12 py-3 rounded-xl text-sm outline-none transition-all"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#1a1f1e", background: "#fafcfb" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,108,74,0.5)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                        style={{ color: "#a8b5af" }}
                      >
                        <span className="material-symbols-outlined text-[18px]">{showPw ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                    {mode === "signup" && (
                      <p className="text-[11px] mt-1.5" style={{ color: "#a8b5af" }}>
                        {PASSWORD_REQUIREMENTS_COPY}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#ef4444" }}>
                      error
                    </span>
                    <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                      {error}
                    </p>
                  </div>
                )}
                {info && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(0,108,74,0.07)", border: "1px solid rgba(0,108,74,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: "#006c4a" }}>
                      mark_email_read
                    </span>
                    <p className="text-xs font-semibold" style={{ color: "#006c4a" }}>
                      {info}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all mt-2"
                  style={{ background: loading ? "#8ab5a0" : "#006c4a", cursor: loading ? "not-allowed" : "pointer" }}
                  onMouseEnter={(e) => {
                    if (!loading) (e.currentTarget as HTMLElement).style.background = "#005f41";
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) (e.currentTarget as HTMLElement).style.background = "#006c4a";
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      {loadingLabel()}
                    </>
                  ) : (
                    <>
                      {submitLabel()}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {mode !== "forgot" && mode !== "verify-email" && (
              <p className="text-center text-sm mt-5" style={{ color: "#8a9e97" }}>
                {mode === "signin" ? (
                  <>
                    New to Execution AI?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-bold transition-opacity hover:opacity-70"
                      style={{ color: "#006c4a" }}
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="font-bold transition-opacity hover:opacity-70"
                      style={{ color: "#006c4a" }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] mt-6 max-w-xs leading-5" style={{ color: "#a8b5af" }}>
          By continuing you accept our{" "}
          <Link href="/terms" className="font-semibold transition-opacity hover:opacity-75" style={{ color: "#006c4a" }}>
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold transition-opacity hover:opacity-75" style={{ color: "#006c4a" }}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
