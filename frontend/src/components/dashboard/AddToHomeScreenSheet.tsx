"use client";

type AddToHomeScreenVariant = "android" | "ios-browser" | "ios-safari";

interface AddToHomeScreenSheetProps {
  variant: AddToHomeScreenVariant;
  onAcknowledge: () => void;
  onDismiss: () => void;
}

interface InstructionStep {
  icon: string;
  title: string;
  detail: string;
}

const COPY: Record<
  AddToHomeScreenVariant,
  {
    badge: string;
    title: string;
    detail: string;
    note?: string;
    steps: InstructionStep[];
  }
> = {
  android: {
    badge: "Android",
    title: "Add Execution AI to your home screen",
    detail: "Keep today close. Open Execution AI in one tap, right from your phone.",
    note: "The wording can vary a little by browser, but the action you want is Add to Home Screen.",
    steps: [
      {
        icon: "more_vert",
        title: "Open your browser menu",
        detail: "Tap the menu icon in the top corner of your browser.",
      },
      {
        icon: "add_box",
        title: "Tap Add to Home Screen",
        detail: "Choose Add to Home Screen, then confirm Add if your browser asks.",
      },
    ],
  },
  "ios-browser": {
    badge: "iPhone",
    title: "Save Execution AI to your home screen",
    detail: "On iPhone, the cleanest add-to-home-screen flow runs through Safari.",
    note: "If you opened Execution AI in another browser, open it in Safari first, then follow the steps below.",
    steps: [
      {
        icon: "open_in_browser",
        title: "Open this page in Safari",
        detail: "Safari is the browser that supports adding this web app to your iPhone home screen.",
      },
      {
        icon: "ios_share",
        title: "Tap Share",
        detail: "Use the Share button in Safari's toolbar.",
      },
      {
        icon: "add_box",
        title: "Tap Add to Home Screen",
        detail: "If you see Open as Web App, leave it on, then tap Add.",
      },
    ],
  },
  "ios-safari": {
    badge: "iPhone",
    title: "Save Execution AI to your home screen",
    detail: "Keep Execution AI feeling app-like with one-tap access from your home screen.",
    steps: [
      {
        icon: "ios_share",
        title: "Tap Share",
        detail: "Use the Share button in Safari.",
      },
      {
        icon: "add_box",
        title: "Tap Add to Home Screen",
        detail: "If you see Open as Web App, leave it on, then tap Add.",
      },
    ],
  },
};

function StepCard({
  index,
  step,
}: {
  index: number;
  step: InstructionStep;
}) {
  return (
    <div
      className="rounded-[24px] px-4 py-4"
      style={{
        background: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 12px 32px rgba(7, 38, 28, 0.08)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,108,74,0.11)", color: "#006c4a" }}
        >
          <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "#8aa097" }}
            >
              Step {index + 1}
            </span>
          </div>
          <h3
            className="font-headline text-[17px] font-bold leading-tight mt-1"
            style={{ color: "#1a1f1e" }}
          >
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed mt-2" style={{ color: "#667771" }}>
            {step.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AddToHomeScreenSheet({
  variant,
  onAcknowledge,
  onDismiss,
}: AddToHomeScreenSheetProps) {
  const copy = COPY[variant];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:hidden"
      style={{ background: "rgba(7, 20, 15, 0.42)", backdropFilter: "blur(8px)" }}
    >
      <div className="w-full">
        <div
          className="mx-auto w-full max-w-lg rounded-t-[32px] overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(242,249,246,0.98) 0%, rgba(255,255,255,0.98) 100%)",
            borderTop: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 -18px 40px rgba(7, 20, 15, 0.18)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-home-screen-title"
        >
          <div className="px-5 pt-3 pb-5">
            <div className="flex justify-center">
              <div
                className="h-1.5 w-14 rounded-full"
                style={{ background: "rgba(26,31,30,0.12)" }}
              />
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-[22px] flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,108,74,0.14) 0%, rgba(0,108,74,0.08) 100%)",
                  color: "#006c4a",
                }}
              >
                <span className="material-symbols-outlined text-[28px]">phone_iphone</span>
              </div>

              <div className="min-w-0">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{
                    background: "rgba(0,108,74,0.09)",
                    color: "#006c4a",
                    border: "1px solid rgba(0,108,74,0.12)",
                  }}
                >
                  {copy.badge}
                </span>
                <h2
                  id="add-to-home-screen-title"
                  className="font-headline text-[26px] leading-[1.05] font-extrabold tracking-tight mt-3"
                  style={{ color: "#1a1f1e" }}
                >
                  {copy.title}
                </h2>
                <p className="text-sm leading-relaxed mt-2" style={{ color: "#667771" }}>
                  {copy.detail}
                </p>
              </div>
            </div>

            {copy.note ? (
              <div
                className="mt-4 rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: "rgba(0,108,74,0.06)",
                  border: "1px solid rgba(0,108,74,0.1)",
                  color: "#315347",
                }}
              >
                {copy.note}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {copy.steps.map((step, index) => (
                <StepCard key={`${variant}-${index}`} index={index} step={step} />
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onAcknowledge}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.99]"
                style={{
                  background: "#003d2b",
                  boxShadow: "0 16px 32px rgba(0,108,74,0.22)",
                }}
              >
                Got it
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  color: "#435650",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
          <div className="h-safe-bottom" />
        </div>
      </div>
    </div>
  );
}

export type { AddToHomeScreenVariant };
