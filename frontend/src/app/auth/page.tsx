"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, LOCAL_TEST_SIGNIN_HINTS } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import { describeSyncError } from "@/lib/apiErrors";
import { isAuthLocalOnly, isCloudPasswordAuthEnabled, isCloudSupabaseConfigured } from "@/lib/authMode";

type Mode = "signin" | "signup" | "forgot";

// OTP path is intentionally disabled for MVP. The code is preserved for post-MVP.
// To re-enable: replace `false` with `isCloudOtpAuthEnabled()`.
const cloudOtpEnabled = false;
const cloudPassword = isCloudPasswordAuthEnabled();
const authLocalOnly = isAuthLocalOnly();
const showLocalSeedPanel = isAuthLocalOnly() || !isCloudSupabaseConfigured();
const showDemoShortcut = !cloudPassword || cloudOtpEnabled || authLocalOnly;

/** Format check only — does not verify the inbox exists or accepts mail. */
const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export default function AuthPage() {
  const router = useRouter();
  const {
    currentUser,
    signIn,
    signUp,
    sendEmailOtp,
    verifyEmailOtp,
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
      sendEmailOtp: state.sendEmailOtp,
      verifyEmailOtp: state.verifyEmailOtp,
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

  const [otpAwaitingCode, setOtpAwaitingCode] = useState(false);
  const [otpDigits, setOtpDigits] = useState("");
  const [resendIn, setResendIn] = useState(0);
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

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f6f4" }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#a8b5af" }}>
          {handingOffToWorkspace ? "Opening your workspace…" : "Loading…"}
        </p>
      </div>
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
    setName("");
    setEmail("");
    setPassword("");
    setOtpAwaitingCode(false);
    setOtpDigits("");
    setResendIn(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

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

    if (cloudOtpEnabled) {
      if (mode === "signup" && !otpAwaitingCode && !name.trim()) {
        setError("Enter your name before continuing.");
        return;
      }

      if (otpAwaitingCode) {
        if (otpDigits.replace(/\D/g, "").length !== 6) {
          setError("Enter the 6-digit code from your email.");
          return;
        }
        setLoading(true);
        const result = await verifyEmailOtp(trimmedEmail, otpDigits, {
          intent: mode === "signup" ? "signup" : "signin",
          fullName: name.trim() || undefined,
        });
        setLoading(false);
        if (!result.success) {
          setError(result.error ?? "Verification failed.");
          return;
        }
        return;
      }

      setLoading(true);
      const send = await sendEmailOtp(trimmedEmail, {
        intent: mode === "signup" ? "signup" : "signin",
        fullName: mode === "signup" ? name.trim() : undefined,
      });
      setLoading(false);
      if (!send.success) {
        setError(send.error);
        return;
      }
      setOtpAwaitingCode(true);
      setOtpDigits("");
      setResendIn(56);
      setInfo("We sent a 6-digit code to your inbox. Enter it below (check spam).");
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
    if (password.length < 8) {
      setError("Use 8 characters or more.");
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
        // Email confirmation is disabled for MVP — project-level Supabase setting controls this.
        // If the user lands here it means they need to confirm; show a message rather than silently failing.
        setInfo("Check your inbox for a confirmation link, then sign in here.");
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  };

  const fillDemo = async () => {
    setError("");
    setInfo("");
    if (cloudOtpEnabled) {
      setLoading(true);
      const r = await signIn("alex@executionai.com", "demo123");
      setLoading(false);
      if (!r.success) setError(r.error ?? "Demo sign-in failed.");
      return;
    }
    setEmail("alex@executionai.com");
    setPassword("demo123");
  };

  const cloudOtpVerify = cloudOtpEnabled && (mode === "signin" || mode === "signup") && otpAwaitingCode;

  const heading =
    mode === "forgot"
      ? "Reset your password."
      : cloudOtpVerify
        ? "Enter your code"
        : mode === "signin"
          ? "Welcome back."
          : "Set up your execution loop.";

  const subline =
    mode === "forgot"
      ? "Enter the email you signed up with. We'll send a reset link."
      : cloudOtpVerify
        ? `Code sent to ${email.trim() || "your email"}. It expires after a few minutes.`
      : cloudOtpEnabled && mode === "signin" && !cloudOtpVerify
        ? "We will email you a one-time 6-digit code. Or use the demo account below."
        : cloudOtpEnabled && mode === "signup" && !cloudOtpVerify
          ? "We will email you a one-time code to verify this address — no password to remember."
          : cloudPassword && mode === "signin"
            ? "Pick up where today left off."
          : cloudPassword && mode === "signup"
            ? "One account. Yearly, monthly, weekly, and daily goals — all linked."
            : authLocalOnly
              ? mode === "signin"
                ? "No company email domain needed. Use a seeded profile or sign up with any address — each user gets their own workspace on your API."
                : "Creates another browser-only account (good for comparing onboarding or dashboard states)."
              : mode === "signin"
                ? "Sign in with email and password (local registry)."
                : "Create a local account with email and password.";

  const submitLabel = () => {
    if (mode === "forgot") return "Send reset link";
    if (cloudOtpEnabled) return cloudOtpVerify ? "Verify & continue" : "Send code";
    return mode === "signup" ? "Begin" : "Sign in";
  };

  const loadingLabel = () => {
    if (mode === "forgot") return "Sending…";
    if (cloudOtpEnabled) return cloudOtpVerify ? "Verifying…" : "Sending code…";
    if (mode === "signup") return "Setting up your account…";
    return "Signing in…";
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#f4f6f4" }}>
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12" style={{ background: "#0d1f18" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(133,248,196,0.15)" }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#85f8c4" }}>
              bolt
            </span>
          </div>
          <div>
            <p className="font-headline font-bold text-base text-white">Execution AI</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              Productivity OS
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#85f8c4" }}>
              Built for Execution
            </p>
            <h1
              className="font-headline font-extrabold leading-tight"
              style={{ fontSize: "40px", color: "#fff", lineHeight: 1.15 }}
            >
              Your goals.
              <br />
              Your momentum.
              <br />
              <span style={{ color: "#85f8c4" }}>Your record.</span>
            </h1>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Execution AI transforms your yearly vision into daily action — with AI-assisted planning, real-time tracking, and a
            full historical archive of your growth.
          </p>

          <div className="flex flex-wrap gap-2">
            {["AI Planning", "Goal Hierarchy", "Daily Focus", "Performance Reports"].map((f) => (
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
              &ldquo;Execution AI gave me clarity I didn&apos;t know I was missing. My productivity went from scattered to
              strategic in the first week.&rdquo;
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: "#006c4a" }}
              >
                S
              </div>
              <div>
                <p className="text-xs font-bold text-white">Sarah M.</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Product Designer · Early Access
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
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#006c4a" }}>
            <span className="material-symbols-outlined text-[18px] text-white">bolt</span>
          </div>
          <p className="font-headline font-bold text-lg" style={{ color: "#1a1f1e" }}>
            Execution AI
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm w-full" style={{ maxWidth: 460, border: "1.5px solid rgba(0,0,0,0.07)" }}>
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

          <div className="p-7 pt-6">
            <div className="mb-6">
              <h2 className="font-headline font-extrabold text-2xl mb-1" style={{ color: "#1a1f1e" }}>
                {heading}
              </h2>
              <p className="text-sm" style={{ color: "#8a9e97" }}>
                {subline}
              </p>
            </div>

            {mode === "signin" && showDemoShortcut && (
              <button
                type="button"
                onClick={() => void fillDemo()}
                disabled={loading}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-5 text-left transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: "rgba(0,108,74,0.06)", border: "1.5px dashed rgba(0,108,74,0.3)" }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>
                  auto_awesome
                </span>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#006c4a" }}>
                    Try the demo account
                  </p>
                  <p className="text-[11px]" style={{ color: "#6b9e88" }}>
                    {cloudOtpEnabled ? "Instant sign-in — no email code" : "alex@executionai.com · demo123"}
                  </p>
                </div>
              </button>
            )}

            {showLocalSeedPanel && !cloudOtpEnabled && mode !== "forgot" && (
              <div
                className="rounded-2xl p-4 mb-5 text-left space-y-2"
                style={{ background: "#f8faf9", border: "1.5px solid rgba(0,108,74,0.12)" }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#006c4a" }}>
                  {authLocalOnly ? "Seeded test profiles" : "Browser-only profiles"}
                </p>
                <p className="text-[10px] leading-relaxed" style={{ color: "#6b7c75" }}>
                  Same flows as production: separate user id, backend session, onboarding, and goals per account. No email inbox
                  required.
                </p>
                <ul className="space-y-1.5">
                  {LOCAL_TEST_SIGNIN_HINTS.map((row) => (
                    <li
                      key={row.email}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      style={{ background: "rgba(255,255,255,0.75)" }}
                    >
                      <span className="text-[11px] min-w-0" style={{ color: "#1a1f1e" }}>
                        <span className="font-bold">{row.label}</span>
                        <span style={{ color: "#8a9e97" }}> · {row.email}</span>
                        <span style={{ color: "#8a9e97" }}> · pw: {row.password}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(row.email);
                          setPassword(row.password);
                          setError("");
                          setInfo("");
                        }}
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg shrink-0"
                        style={{ background: "rgba(0,108,74,0.1)", color: "#006c4a" }}
                      >
                        Fill
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-xs font-bold mb-2 flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ color: "#006c4a" }}
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  Back to sign in
                </button>
              )}

              {mode === "signup" && !cloudOtpVerify && (
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

              {!cloudOtpVerify && (
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
                  {cloudOtpEnabled && mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[11px] font-bold mt-2 transition-opacity hover:opacity-70"
                      style={{ color: "#006c4a" }}
                    >
                      Forgot password? (email reset link)
                    </button>
                  )}
                </div>
              )}

              {cloudOtpVerify && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-center uppercase tracking-wider" style={{ color: "#6b7c75" }}>
                    6-digit code
                  </label>
                  <OtpCodeInput value={otpDigits} onChange={setOtpDigits} disabled={loading} autoFocus />
                  <p className="text-[10px] text-center leading-relaxed" style={{ color: "#a8b5af" }}>
                    In Supabase → Authentication → Email Templates, add{" "}
                    <code className="text-[10px] px-1 rounded" style={{ background: "#f0f3f1" }}>
                      {`{{ .Token }}`}
                    </code>{" "}
                    to both the Magic link and Confirm sign up templates (new accounts may use Confirm sign up).{" "}
                    <a
                      className="underline font-semibold"
                      style={{ color: "#006c4a" }}
                      href="https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp"
                      target="_blank"
                      rel="noreferrer"
                    >
                      OTP docs
                    </a>
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      disabled={loading || resendIn > 0}
                      onClick={async () => {
                        setError("");
                        setInfo("");
                        setLoading(true);
                        const em = email.trim().toLowerCase();
                        const r = await sendEmailOtp(em, {
                          intent: mode === "signup" ? "signup" : "signin",
                          fullName: mode === "signup" ? name.trim() : undefined,
                        });
                        setLoading(false);
                        if (!r.success) {
                          setError(r.error);
                          return;
                        }
                        setResendIn(56);
                        setInfo("New code sent.");
                      }}
                      className="text-xs font-bold py-2 rounded-xl transition-opacity disabled:opacity-40"
                      style={{ color: "#006c4a", background: "rgba(0,108,74,0.06)" }}
                    >
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpAwaitingCode(false);
                        setOtpDigits("");
                        setError("");
                        setInfo("");
                        setResendIn(0);
                      }}
                      className="text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: "#8a9e97" }}
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              )}

              {!cloudOtpEnabled && mode !== "forgot" && (
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
                      Used to protect your data. Nothing more.
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

            {mode !== "forgot" && (
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

        <p className="text-center text-[11px] mt-6 max-w-xs" style={{ color: "#a8b5af" }}>
          By continuing you accept our Terms and Privacy.
        </p>
      </div>
    </div>
  );
}
