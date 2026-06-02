import { LandingAuthGate } from "@/components/landing/LandingAuthGate";

const APP_URL = "/auth";

const FEATURE_PILLS = [
  "Behavior Intelligence",
  "Smart Planning",
  "Accountability That Works",
];

const FEATURE_CARDS = [
  {
    icon: "target",
    title: "Set goals that matter",
    copy: "Define yearly, monthly, weekly, and daily goals with clarity so the work in front of you stays connected to the future you are building.",
  },
  {
    icon: "schedule",
    title: "Plan around real life",
    copy: "Structure your day around priorities, capacity, and current momentum instead of forcing unrealistic plans that break by midday.",
  },
  {
    icon: "timeline",
    title: "Behavioral insights",
    copy: "Surface the habits, patterns, and execution signals shaping progress so your growth becomes understandable and improvable.",
  },
  {
    icon: "visibility",
    title: "Track and reflect",
    copy: "See what you planned, what you executed, and where your follow-through shifts across weeks and months.",
  },
  {
    icon: "task_alt",
    title: "Stay accountable",
    copy: "Use AI guidance, reviews, and check-ins to stay consistent when motivation is low and priorities start to drift.",
  },
  {
    icon: "person_play",
    title: "Built for real life",
    copy: "For founders, creators, professionals, students, and ambitious builders who want a system that grows with them.",
  },
];

const HOW_STEPS = [
  {
    number: "01",
    title: "Tell us what matters",
    copy: "Set the direction with your goals, routines, priorities, and the areas where you want sharper follow-through.",
  },
  {
    number: "02",
    title: "AI structures the system",
    copy: "Execution AI helps shape yearly, monthly, weekly, and daily planning into a connected execution flow.",
  },
  {
    number: "03",
    title: "Execute with clarity",
    copy: "Work the plan, track the day, and keep action grounded in the bigger goals instead of scattered motion.",
  },
  {
    number: "04",
    title: "Review and improve",
    copy: "Learn from your patterns, see what is helping or hurting progress, and refine how you execute over time.",
  },
];

const WHY_CARDS = [
  {
    icon: "neurology",
    title: "Designed for your brain",
    copy: "Execution AI works with your patterns, not against them, so consistency becomes more realistic and more sustainable.",
  },
  {
    icon: "verified_user",
    title: "Real accountability",
    copy: "Not just reminders. You get check-ins, reviews, and honest signals when execution starts drifting.",
  },
  {
    icon: "bolt",
    title: "Adaptable and personal",
    copy: "Your workload, season, and goals change. The planning system should shift with you instead of breaking under it.",
  },
  {
    icon: "lock",
    title: "Private by default",
    copy: "Your planning data, reports, and growth signals are handled with care and not treated like public performance content.",
  },
];

const EARLY_ACCESS_ITEMS = [
  { icon: "check_circle", line1: "Be among", line2: "the first" },
  { icon: "deployed_code", line1: "Early access", line2: "to new features" },
  { icon: "schedule", line1: "100% free", line2: "during beta" },
];

const EARLY_BELIEVERS = [
  {
    name: "Daniel K.",
    role: "Founder",
    copy: "Execution AI helps me focus on what actually matters. It feels less like a planner and more like a system that pushes me to follow through.",
    avatar: "DK",
  },
  {
    name: "Aisha M.",
    role: "Graduate student",
    copy: "The structure finally connects my long-term goals to what I am doing today. That is the first time a tool has made my planning feel coherent.",
    avatar: "AM",
  },
  {
    name: "Marcus T.",
    role: "Operator",
    copy: "The behavior angle is what makes it different. It is not just telling me what to do. It is showing me how I actually work.",
    avatar: "MT",
  },
];

export default function RootPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fa] text-[#2b3437]">
      <LandingAuthGate />

      <div className="mx-auto max-w-7xl px-6">
        <nav className="flex items-center justify-between py-6">
          <div className="text-[30px] font-extrabold tracking-[-0.05em] text-[#10261d] md:text-[34px]">
            Execution <span className="text-[#006c4a]">AI</span>
          </div>

          <div className="ml-auto hidden items-center gap-7 pr-5 text-sm font-semibold text-[#586064] md:flex">
            <a href="#features" className="transition-colors hover:text-[#10261d]">Features</a>
            <a href="#how" className="transition-colors hover:text-[#10261d]">How It Works</a>
            <a href="#why" className="transition-colors hover:text-[#10261d]">Why Execution AI</a>
            <a href="#believers" className="transition-colors hover:text-[#10261d]">Early Believers</a>
          </div>

          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 rounded-[18px] bg-[#006c4a] px-5 py-3 text-sm font-extrabold text-white shadow-[0_16px_32px_rgba(0,108,74,0.16)] transition-all hover:-translate-y-0.5 hover:bg-[#005f41]"
          >
            Try the Beta
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </nav>
      </div>

      <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:py-18">
        <div>
          <span className="inline-flex animate-[pulse-dot_1.9s_ease-in-out_infinite] rounded-full border border-[#bfe7d4] bg-[#eef5f0] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#006c4a] shadow-[0_12px_30px_rgba(0,108,74,0.08)]">
            Beta Access
          </span>

          <h1 className="mt-8 max-w-2xl font-headline text-6xl font-extrabold leading-[0.97] tracking-[-0.05em] text-[#13241d] md:text-7xl">
            Your goals.
            <br />
            Your behavior.
            <br />
            <span className="text-[#006c4a]">Your growth.</span>
          </h1>

          <p className="mt-7 max-w-[42rem] text-[20px] font-medium leading-[1.78] tracking-[-0.015em] text-[#4e5955]">
            Execution AI helps ambitious builders turn long-range direction into structured daily execution with linked planning,
            AI support, and visibility into the patterns shaping progress.
          </p>

          <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold text-[#586064]">
            {FEATURE_PILLS.map((pill) => (
              <span key={pill} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-[#e7ece9]">
                <span className="material-symbols-outlined text-[16px] text-[#006c4a]">check_circle</span>
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              className="inline-flex items-center gap-2 rounded-[18px] bg-[#006c4a] px-7 py-4 font-bold text-white shadow-[0_16px_32px_rgba(0,108,74,0.16)] transition hover:bg-[#005f41]"
              href={APP_URL}
            >
              Try the Beta
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-[18px] border border-[#7fcfb0] bg-white px-7 py-4 font-bold text-[#006c4a] transition hover:bg-[#eef5f0]"
              href="#how"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-10 border-t border-[#eaeff1] pt-5">
            <p className="text-[13px] font-medium tracking-[-0.01em] text-[#52605b]">Be among the first to experience Execution AI.</p>

            <div className="mt-3 inline-flex max-w-[41rem] rounded-[20px] border border-[#e5ece8] bg-white px-4 py-3 shadow-[0_6px_14px_rgba(23,41,32,0.045)]">
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
                {EARLY_ACCESS_ITEMS.map((item) => (
                  <div
                    key={item.line1}
                    className="flex items-center gap-2.5 text-[13px] font-medium tracking-[-0.01em] text-[#596662]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e1e9e5] bg-[#f8fbf9] text-[#006c4a] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                    </span>
                    <span className="leading-[1.15]">
                      <span className="block font-semibold text-[#33413b]">{item.line1}</span>
                      <span className="mt-0.5 block">{item.line2}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <HeroProductVisual />
      </section>

      <section id="features" className="border-y border-[#eaeff1] bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#006c4a]">
                What is Execution AI?
              </p>
              <h2 className="mt-4 font-headline text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#13241d]">
                Your personal system for
                <br />
                <span className="text-[#006c4a]">execution and growth.</span>
              </h2>
            </div>

            <p className="max-w-lg text-lg leading-8 text-[#586064]">
              Execution AI is not just another planner. It helps you structure your goals, execute intentionally, understand your
              behavioral patterns, and improve how you follow through over time.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="rounded-3xl border border-[#eaeff1] bg-white p-7 shadow-[0_16px_36px_rgba(22,39,31,0.05)]">
                <div className="mb-5 w-fit rounded-2xl bg-[#eef5f0] p-4 text-[#006c4a]">
                  <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
                </div>
                <h3 className="font-headline text-[24px] font-extrabold tracking-[-0.03em] text-[#1a2722]">{card.title}</h3>
                <p className="mt-3 leading-7 text-[#586064]">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#006c4a]">How it works</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#13241d] md:text-5xl">
              A connected system for
              <span className="text-[#006c4a]"> better follow-through.</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#586064]">
              Execution AI is designed to carry direction into action, then turn that action into clearer self-awareness over time.
            </p>
          </div>

          <div className="relative mt-16">
            <div className="absolute left-[11%] right-[11%] top-10 hidden h-px bg-gradient-to-r from-transparent via-[#9fdbc0] to-transparent lg:block" />
            <div className="grid gap-6 lg:grid-cols-4">
              {HOW_STEPS.map((step) => (
                <div
                  key={step.number}
                  className="interactive-card relative overflow-hidden rounded-[30px] border border-[#e6ece8] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfb_100%)] p-7 shadow-[0_20px_44px_rgba(22,39,31,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(22,39,31,0.1)]"
                >
                  <div className="absolute inset-0 opacity-[0.55]">
                    <div className="absolute -right-16 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(133,248,196,0.16),transparent_68%)]" />
                    <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(0,108,74,0.07),transparent_72%)]" />
                    <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,rgba(127,207,176,0.32),transparent)]" />
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(0,108,74,0.022)_0_2px,transparent_2px_12px)]" />
                    <div className="absolute bottom-0 left-0 h-24 w-full bg-[linear-gradient(180deg,transparent_0%,rgba(238,245,240,0.82)_100%)]" />
                  </div>
                  <span className="relative z-10 inline-flex h-12 min-w-12 items-center justify-center rounded-full bg-[#0f241c] px-3 text-base font-extrabold tracking-[-0.03em] text-[#85f8c4]">
                    {step.number}
                  </span>
                  <h3 className="relative z-10 mt-6 text-[24px] font-extrabold tracking-[-0.03em] text-[#1a2722]">{step.title}</h3>
                  <p className="relative z-10 mt-3 text-[15px] font-medium leading-7 text-[#55615d]">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="xl:pt-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#006c4a]">Why Execution AI?</p>
            <h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#13241d] md:text-5xl">
              More than planning.
              <span className="text-[#006c4a]"> Built for better execution.</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#586064]">
              The difference is not just structure. It is the way the product helps you understand your patterns, protect momentum,
              and improve how you actually follow through.
            </p>

            <div className="mt-8 rounded-[28px] border border-[#dde7e1] bg-[linear-gradient(180deg,#0f211b_0%,#17362a_100%)] p-6 text-white shadow-[0_24px_54px_rgba(12,30,23,0.18)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#85f8c4]">Behavioral pattern highlight</p>
              <h3 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">
                Progress becomes clearer when your system can explain your behavior.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/76">
                Execution AI helps you spot the rhythms, routines, and friction points that shape whether goals actually move.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InteractiveMetric value="72%" label="Goal alignment" />
                <InteractiveMetric value="85%" label="Consistency" />
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {WHY_CARDS.map((card, index) => (
              <div
                key={card.title}
                className={`interactive-card group relative overflow-hidden rounded-[30px] border border-[#e4ebe7] p-6 shadow-[0_18px_42px_rgba(22,39,31,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(22,39,31,0.1)] ${
                  index === 0 || index === 3
                    ? "bg-[linear-gradient(180deg,#f8fbf9_0%,#ffffff_100%)]"
                    : "bg-[linear-gradient(180deg,#ffffff_0%,#f4f8f5_100%)]"
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#85f8c4] via-[#006c4a] to-[#9fdbc0] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef5f0] text-[#006c4a] shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
                  </span>
                </div>
                <h3 className="mt-6 text-[24px] font-extrabold tracking-[-0.03em] text-[#1a2722]">{card.title}</h3>
                <p className="mt-3 text-[15px] font-medium leading-7 text-[#55615d]">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="relative overflow-hidden rounded-[34px] bg-[#006c4a] p-10 text-white shadow-[0_28px_64px_rgba(0,108,74,0.22)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.11),transparent_24%),radial-gradient(circle_at_92%_14%,rgba(133,248,196,0.14),transparent_26%)]" />
            <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/8 blur-3xl" />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#85f8c4]/14 blur-3xl" />
            <div className="absolute inset-x-10 bottom-8 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
            <svg className="absolute inset-0 h-full w-full opacity-35" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 250C120 225 190 180 300 178C430 176 480 260 620 258C780 256 840 150 980 152C1082 153 1138 192 1200 220" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
              <path d="M0 276C112 248 178 214 284 212C422 210 492 292 634 290C790 288 850 182 992 182C1086 182 1140 214 1200 238" fill="none" stroke="rgba(133,248,196,0.16)" strokeWidth="1.5" />
              <path d="M0 304C130 280 220 248 330 248C456 248 534 320 668 320C820 320 890 220 1022 220C1102 220 1152 244 1200 266" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="relative z-10">
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em]">
                Beta Access
              </span>
              <h2 className="mt-6 max-w-xl font-headline text-4xl font-extrabold leading-tight tracking-[-0.04em]">
                Be part of the first users shaping the future.
              </h2>
              <p className="mt-4 max-w-lg text-white/80">
                Execution AI is currently in beta. Join early, give feedback, and help shape the product while it is still evolving quickly.
              </p>
            </div>

            <div className="relative z-10">
              <a
                href={APP_URL}
                className="flex items-center justify-between rounded-[18px] bg-white px-7 py-5 font-extrabold text-[#006c4a]"
              >
                Try the Beta
                <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
              </a>

              <div className="mt-5 flex flex-wrap gap-5 text-sm text-white/80">
                <span>✓ Free during beta</span>
                <span>✓ Early access</span>
                <span>✓ Shape the product</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="believers" className="py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#006c4a]">Early believers</p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-[#13241d] md:text-5xl">
            People already see the
            <span className="text-[#006c4a]"> direction.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#586064]">
            Execution AI is still early, but the signal is clear: the combination of structured planning and behavioral insight is resonating.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {EARLY_BELIEVERS.map((item) => (
              <div key={item.name} className="interactive-card flex h-full flex-col rounded-[30px] border border-[#e6ece8] bg-white p-7 text-left shadow-[0_18px_42px_rgba(22,39,31,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(22,39,31,0.1)]">
                <div className="flex items-center gap-1 text-[#006c4a]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className="material-symbols-outlined filled text-[18px]">star</span>
                  ))}
                </div>
                <p className="mt-5 flex-1 text-[16px] leading-8 text-[#586064]">&ldquo;{item.copy}&rdquo;</p>
                <div className="mt-8 flex items-center gap-4">
                  <AvatarBadge label={item.avatar} />
                  <div>
                    <p className="text-lg font-extrabold tracking-[-0.03em] text-[#1a2722]">{item.name}</p>
                    <p className="mt-1 text-sm font-medium text-[#6c7873]">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#003d2d] px-6 py-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-4">
          <div>
            <h3 className="text-3xl font-extrabold tracking-[-0.04em]">Execution AI</h3>
            <p className="mt-4 text-sm leading-7 text-white/70">Your system for clarity, focus, accountability, and execution.</p>
          </div>

          <Footer title="Product" items={[{ label: "Features", href: "#features" }, { label: "How It Works", href: "#how" }, { label: "Early Believers", href: "#believers" }]} />
          <Footer title="Company" items={[{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "Contact", href: "mailto:hello@executionai.me" }]} />

          <div>
            <h4 className="font-bold">Stay Updated</h4>
            <p className="mt-3 text-sm leading-7 text-white/70">Follow the beta, try new features early, and help shape what comes next.</p>
            <a href={APP_URL} className="mt-5 inline-flex items-center gap-2 rounded-[18px] bg-[#006c4a] px-5 py-3 font-bold">
              Try the Beta
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/55">
          © 2026 Execution AI · All rights reserved
        </div>
      </footer>
    </main>
  );
}

function HeroProductVisual() {
  return (
    <div className="relative">
      <div className="absolute -left-8 top-10 hidden h-32 w-32 rounded-full bg-[#85f8c4]/24 blur-3xl lg:block" />
      <div className="absolute -right-6 bottom-10 hidden h-36 w-36 rounded-full bg-[#006c4a]/20 blur-3xl lg:block" />

      <div className="relative overflow-hidden rounded-[36px] border border-[#e6ece8] bg-white p-6 shadow-[0_34px_80px_rgba(22,39,31,0.15)]">
        <div className="rounded-[30px] bg-[linear-gradient(180deg,#0c1e17_0%,#10231c_100%)] p-6 text-white lg:p-7">
          <div className="grid gap-5 lg:grid-cols-2">
            <HeroStatCard
              title="Yearly alignment"
              eyebrow="Career expansion"
              value="72%"
              copy="You are staying aligned with your highest priority goals this year."
            />
            <BehaviorReviewCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStatCard({
  title,
  eyebrow,
  value,
  copy,
}: {
  title: string;
  eyebrow: string;
  value: string;
  copy: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/42">{title}</p>
          <p className="mt-3 text-sm font-medium text-white/62">{eyebrow}</p>
        </div>
        <span className="rounded-full border border-[#67e2aa]/40 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#85f8c4]">
          2025
        </span>
      </div>
      <p className="mt-4 text-[56px] font-extrabold leading-none tracking-[-0.05em] text-white">{value}</p>
      <div className="mt-4 h-2 rounded-full bg-white/10">
        <div className="h-2 w-[72%] rounded-full bg-[linear-gradient(90deg,#67e2aa_0%,#8df7c7_100%)]" />
      </div>
      <p className="mt-4 text-[15px] leading-7 text-white/62">{copy}</p>
      <div className="mt-6 space-y-4 border-t border-white/8 pt-5">
        {[
          ["Career", "72%", "work"],
          ["Health", "60%", "favorite"],
          ["Finance", "68%", "monetization_on"],
          ["Growth", "85%", "menu_book"],
        ].map(([label, progress, icon]) => (
          <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-[#85f8c4]">{icon}</span>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/82">{label}</p>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#67e2aa_0%,#8df7c7_100%)]"
                  style={{ width: progress }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-[#85f8c4]">{progress}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BehaviorReviewCard() {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/42">Behavior review</p>
          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#85f8c4]">Observation</p>
        </div>
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[#85f8c4]">
          <span className="material-symbols-outlined text-[28px]">neurology</span>
        </span>
      </div>
      <div className="mt-4 rounded-[20px] border border-white/8 bg-black/10 p-5">
        <div className="flex items-center gap-2 text-[#8df7c7]">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.16em]">Behavior pattern</span>
        </div>
        <p className="mt-4 text-[15px] font-medium leading-7 text-white/82">
          From recent weeks, we&apos;ve noticed you complete more of your day when you keep the plan to one main task and one secondary goal.
        </p>
        <ul className="mt-4 space-y-2 text-[15px] text-white/76">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#85f8c4]">check_circle</span>
            1 main goal
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#85f8c4]">check_circle</span>
            1–2 secondary goals
          </li>
        </ul>
      </div>
      <div className="mt-5 border-t border-white/8 pt-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#85f8c4]">Recommendation</p>
        <p className="mt-3 text-[15px] leading-7 text-white/68">
          Keep tomorrow lighter and protect your first deep work block before adding extra tasks.
        </p>
      </div>
    </div>
  );
}

function InteractiveMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-[28px] font-extrabold tracking-[-0.04em] text-[#85f8c4]">{value}</p>
      <p className="mt-1 text-sm font-medium text-white/72">{label}</p>
    </div>
  );
}

function AvatarBadge({ label }: { label: string }) {
  return (
    <div className="relative h-14 w-14 overflow-hidden rounded-full ring-1 ring-[#dce6e1]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,#d8f5e8_0%,#71cba5_36%,#0f241c_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.16),transparent_45%)]" />
      <div className="absolute inset-x-0 bottom-0 h-7 bg-[linear-gradient(180deg,transparent,rgba(4,17,13,0.44))]" />
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tracking-[0.08em] text-white">
        {label}
      </span>
    </div>
  );
}

function Footer({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="font-bold">{title}</h4>
      <div className="mt-4 grid gap-2 text-sm text-white/70">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="transition-opacity hover:opacity-80">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
