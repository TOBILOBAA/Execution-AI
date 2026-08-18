import { LandingAuthGate } from "@/components/landing/LandingAuthGate";

const APP_URL = "/auth";

const FEATURE_PILLS = [
  "Year-to-day alignment",
  "Behavior insights",
  "Weekly course-correction",
];

const FEATURE_CARDS = [
  {
    icon: "timeline",
    title: "Detect behavior patterns",
    copy: "See which routines, timing, and execution habits are helping progress or creating drift.",
  },
  {
    icon: "visibility",
    title: "Review with evidence",
    copy: "Track what you planned, what you completed, and where consistency starts to break.",
  },
  {
    icon: "task_alt",
    title: "Course-correct quickly",
    copy: "Get clear guidance on what to adjust this week before the year drifts further off track.",
  },
  {
    icon: "target",
    title: "Connect every level",
    copy: "Map yearly goals into monthly, weekly, and daily execution so the work in front of you always has context.",
  },
  {
    icon: "schedule",
    title: "Plan for real capacity",
    copy: "Build realistic plans you can actually complete, not ideal plans you abandon by midweek.",
  },
  {
    icon: "person_play",
    title: "Built for intentional improvers",
    copy: "For people serious about their growth who want a system, not random motivation.",
  },
];

const HOW_STEPS = [
  {
    number: "01",
    title: "Set your yearly direction",
    copy: "Choose the life areas and outcomes that matter most this year.",
  },
  {
    number: "02",
    title: "Break it into executable plans",
    copy: "Use guided planning with optional AI support for your monthly, weekly, and daily focus.",
  },
  {
    number: "03",
    title: "Execute and track behavior",
    copy: "Complete priorities and routines while preserving linkage to the bigger goals they are meant to move.",
  },
  {
    number: "04",
    title: "Review and adjust weekly",
    copy: "Identify what is helping or hurting progress, then make one clear correction before drift compounds.",
  },
];

const WHY_CARDS = [
  {
    icon: "neurology",
    title: "Behavior visibility",
    copy: "See which routines, decisions, and planning habits are helping or hurting progress across your life areas.",
  },
  {
    icon: "verified_user",
    title: "Detect drift early",
    copy: "See when momentum is slipping before a rough week turns into a lost month.",
  },
  {
    icon: "bolt",
    title: "Low-effort follow-through",
    copy: "Daily use is designed to stay lightweight so the system helps execution instead of becoming more admin work.",
  },
  {
    icon: "lock",
    title: "Evidence you can trust",
    copy: "Recommendations should tie back to real execution patterns, not generic productivity advice.",
  },
];

const EARLY_ACCESS_ITEMS = [
  { icon: "track_changes", line1: "See what drives", line2: "your yearly growth" },
  { icon: "deployed_code", line1: "Guided setup", line2: "from year to day" },
  { icon: "schedule", line1: "100% free", line2: "during beta" },
];

const EARLY_BELIEVERS = [
  {
    name: "Daniel K.",
    role: "Solopreneur",
    stars: 5,
    copy: "I realized my week looked full, but my main yearly goal was barely moving. Seeing that gap changed how I planned my days.",
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    name: "Aisha M.",
    role: "Student",
    stars: 4,
    copy: "What clicked for me was seeing how my daily execution was affecting my thesis goal. It made the drift obvious much earlier.",
    image: "https://images.unsplash.com/photo-1745196934348-52d80e0da259?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    name: "Marcus T.",
    role: "Gym instructor",
    stars: 5,
    copy: "Most tools show what I finished. This is the first one that made it clearer why some weeks still were not moving the goals I cared about.",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=160&h=160&q=80",
  },
];

const HERO_SIGNAL_CHAIN = [
  { label: "Yearly goal", value: "Launch Execution AI beta" },
  { label: "Monthly focus", value: "Polish onboarding and reports" },
  { label: "Weekly sprint", value: "Ship the live landing update" },
  { label: "Today", value: "Publish and gather early feedback" },
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
            Start free
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </nav>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12 lg:py-24">
        <div className="max-w-4xl">
          <span className="inline-flex animate-[pulse-dot_1.9s_ease-in-out_infinite] rounded-full border border-[#bfe7d4] bg-[#eef5f0] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#006c4a] shadow-[0_12px_30px_rgba(0,108,74,0.08)]">
            Beta access
          </span>

          <h1 className="mt-8 max-w-2xl font-headline text-6xl font-extrabold leading-[0.97] tracking-[-0.05em] text-[#13241d] md:text-7xl">
            See what actually
            <br />
            <span className="text-[#006c4a]">moves your yearly goals.</span>
          </h1>

          <p className="mt-7 max-w-[42rem] text-[19px] font-medium leading-[1.65] tracking-[-0.015em] text-[#4e5955]">
            Execution AI connects your yearly goals to daily actions so you can see what is helping your growth and what is causing drift.
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
              Start free
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
            <p className="text-[20px] font-extrabold tracking-[-0.03em] text-[#13241d]">
              Built to help you finish at least 80% of your yearly goals.
            </p>
            <p className="text-[13px] font-medium tracking-[-0.01em] text-[#52605b]">
              For people intentional about their growth who already set yearly goals and want better follow-through.
            </p>

            <div className="mt-3 w-full max-w-[41rem] rounded-[20px] border border-[#e5ece8] bg-white px-4 py-3 shadow-[0_6px_14px_rgba(23,41,32,0.045)]">
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

        <ExecutionSignalCard />
      </section>

      <section id="features" className="border-y border-[#eaeff1] bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#006c4a]">
                What is Execution AI?
              </p>
              <h2 className="mt-4 font-headline text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#13241d]">
                Your execution system
                <br />
                <span className="text-[#006c4a]">for the whole year.</span>
              </h2>
            </div>

            <p className="max-w-lg text-lg leading-8 text-[#586064]">
              Most tools track tasks. Execution AI tracks whether your daily behavior is moving your yearly goals, then turns that
              into clearer feedback on what needs attention next.
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
              From yearly direction to
              <span className="text-[#006c4a]"> daily execution.</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#586064]">
              Execution AI keeps your goals connected from year to day and helps you improve with weekly evidence instead of guesswork.
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
              Not just productivity.
              <span className="text-[#006c4a]"> Better execution decisions.</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#586064]">
              The goal is not to do more tasks. The goal is to finish more of the right yearly goals by understanding how you
              actually execute.
            </p>

            <div className="mt-8 rounded-[28px] border border-[#dde7e1] bg-[linear-gradient(180deg,#0f211b_0%,#17362a_100%)] p-6 text-white shadow-[0_24px_54px_rgba(12,30,23,0.18)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#85f8c4]">Behavioral pattern highlight</p>
              <h3 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em]">
                When behavior is visible, progress becomes more predictable.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/76">
                Execution AI surfaces recurring patterns like drifting focus areas and missed routine windows so you can intervene early.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InteractiveMetric value="72%" label="Example alignment" />
                <InteractiveMetric value="85%" label="Example consistency" />
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
                Catch drift early
              </span>
              <h2 className="mt-6 max-w-xl font-headline text-4xl font-extrabold leading-tight tracking-[-0.04em]">
                Your year does not slip all at once.
              </h2>
              <p className="mt-4 max-w-lg text-white/80">
                It slips when daily execution disconnects from the goals you set. Execution AI helps you spot that earlier and know what to adjust next.
              </p>
            </div>

            <div className="relative z-10">
              <a
                href={APP_URL}
                className="flex items-center justify-between rounded-[18px] bg-white px-7 py-5 font-extrabold text-[#006c4a]"
              >
                Start free
                <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
              </a>

              <div className="mt-5 flex flex-wrap gap-5 text-sm text-white/80">
                <span>✓ See what is drifting</span>
                <span>✓ Know what to adjust</span>
                <span>✓ Protect yearly progress</span>
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
            What people respond to most is finally seeing why progress drifts and what to change next.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {EARLY_BELIEVERS.map((item) => (
              <div key={item.name} className="interactive-card flex h-full flex-col rounded-[30px] border border-[#e6ece8] bg-white p-7 text-left shadow-[0_18px_42px_rgba(22,39,31,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(22,39,31,0.1)]">
                <div className="flex items-center gap-1 text-[#006c4a]">
                  {Array.from({ length: item.stars }).map((_, index) => (
                    <span key={index} className="material-symbols-outlined filled text-[18px]">star</span>
                  ))}
                </div>
                <p className="mt-5 flex-1 text-[16px] leading-8 text-[#586064]">&ldquo;{item.copy}&rdquo;</p>
                <div className="mt-8 flex items-center gap-4">
                  <TestimonialImage src={item.image} alt={item.name} />
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
            <p className="mt-4 text-sm leading-7 text-white/70">
              See what moves your yearly goals and adjust before you drift.
            </p>
          </div>

          <Footer title="Product" items={[{ label: "Features", href: "#features" }, { label: "How It Works", href: "#how" }, { label: "Early Believers", href: "#believers" }]} />
          <Footer title="Company" items={[{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "Contact", href: "mailto:hello@executionai.me" }]} />

          <div>
            <h4 className="font-bold">Start your year clearly</h4>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Set your yearly goals, connect them to daily action, and start seeing what is helping your growth or causing drift.
            </p>
            <a href={APP_URL} className="mt-5 inline-flex items-center gap-2 rounded-[18px] bg-[#006c4a] px-5 py-3 font-bold">
              Start free
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

function InteractiveMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-[28px] font-extrabold tracking-[-0.04em] text-[#85f8c4]">{value}</p>
      <p className="mt-1 text-sm font-medium text-white/72">{label}</p>
    </div>
  );
}

function ExecutionSignalCard() {
  return (
    <aside className="relative mt-12 lg:mt-4">
      <div className="absolute inset-x-8 top-12 h-32 rounded-full bg-[#85f8c4]/20 blur-3xl" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-[32px] border border-[#dce9e2] bg-[linear-gradient(180deg,#ffffff_0%,#f5faf7_100%)] p-6 shadow-[0_24px_60px_rgba(19,36,29,0.09)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(133,248,196,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.55),transparent_36%)]" />

        <div className="relative">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#006c4a]">
            Execution signal
          </p>
          <h3 className="mt-3 text-[28px] font-extrabold tracking-[-0.04em] text-[#13241d]">
            Momentum looks strong.
          </h3>

          <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#53615c]">
            A compact view of how Execution AI links yearly direction to today&apos;s action and explains whether the user is moving well.
          </p>

          <div className="mt-6 rounded-[24px] border border-[#dfe9e4] bg-[#fdfefe] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6b7b75]">
                  Current read
                </p>
                <p className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-[#183227]">
                  Your best weeks start with one clear main goal.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-[#0f241c] px-4 py-3 text-center text-white shadow-[0_18px_30px_rgba(15,36,28,0.16)]">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#85f8c4]">Signal</p>
                <p className="mt-1 text-[24px] font-extrabold tracking-[-0.04em]">84%</p>
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full bg-[#dbe8e1]">
              <div className="h-2 w-[84%] rounded-full bg-[linear-gradient(90deg,#0f241c_0%,#006c4a_52%,#85f8c4_100%)]" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {HERO_SIGNAL_CHAIN.map((item, index) => (
              <div key={item.label} className="flex items-start gap-3 rounded-[20px] border border-[#e4ece7] bg-white/80 px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef5f0] text-[11px] font-extrabold text-[#006c4a]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7a8782]">{item.label}</p>
                  <p className="mt-1 text-[14px] font-semibold leading-6 text-[#22302a]">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TestimonialImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 rounded-full object-cover ring-1 ring-[#dce6e1]"
    />
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
