export const LEGAL_LAST_UPDATED = "May 26, 2026";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const privacySections: LegalSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "Execution AI respects your privacy. This Privacy Policy explains how we collect, use, store, disclose, and protect information when you use our website, applications, and related services.",
      "Execution AI is a planning and execution platform that helps users organize goals, routines, tasks, reports, and AI-assisted workflows. Because the service is designed to support personal and professional planning, we may process information that users choose to place into the platform as part of their use of the service.",
    ],
  },
  {
    title: "Information We Collect",
    paragraphs: [
      "We collect information you provide directly, information generated through your use of the service, and certain technical information needed to operate and secure the platform.",
    ],
    bullets: [
      "Account information, such as your name, email address, and account credentials or authentication records.",
      "Workspace content, including goals, routines, tasks, categories, priorities, planning data, reports, notes, reflections, and other content you create or store in the platform.",
      "AI interaction data, such as prompts, approvals, edits, and generated planning or reporting outputs used to provide AI-assisted features.",
      "Technical and usage information, such as device and browser information, IP address, timestamps, session information, log data, and timezone or locale information.",
      "Communications, including support messages and emails related to sign-up, verification, password reset, product notices, and service-related updates.",
    ],
  },
  {
    title: "How We Use Information",
    bullets: [
      "To provide, operate, maintain, and improve Execution AI.",
      "To create and manage accounts, authenticate users, and secure access to workspaces.",
      "To save, organize, and display user goals, routines, tasks, reports, and execution history.",
      "To generate AI-assisted suggestions, reports, summaries, and related outputs.",
      "To monitor reliability, troubleshoot issues, prevent misuse, and protect the security of the service.",
      "To communicate with users about their accounts, support requests, service updates, or security matters.",
      "To comply with legal obligations, enforce our Terms of Use, and protect the rights, safety, and property of Execution AI and others.",
    ],
  },
  {
    title: "AI Features",
    paragraphs: [
      "Execution AI includes AI-assisted features that may analyze user inputs and produce suggested plans, summaries, reports, or other outputs. These features are intended to support execution and decision-making, not replace your judgment.",
      "We may process relevant user content through third-party AI infrastructure providers strictly to deliver these features. AI-generated outputs may be incomplete, inaccurate, or unsuitable for your situation, and you remain responsible for reviewing any output before relying on it.",
    ],
  },
  {
    title: "How We Share Information",
    paragraphs: [
      "We do not sell your personal information in the ordinary meaning of that term. We may share information only as reasonably necessary to operate and protect the service.",
    ],
    bullets: [
      "With service providers and infrastructure vendors that support authentication, hosting, storage, email delivery, and AI functionality.",
      "If required by law, regulation, subpoena, court order, or similar legal process.",
      "To investigate, prevent, or respond to fraud, abuse, security incidents, or violations of our Terms.",
      "In connection with a merger, financing, acquisition, restructuring, sale of assets, or similar business transaction.",
      "With your consent or at your direction.",
    ],
  },
  {
    title: "Data Retention",
    paragraphs: [
      "We keep personal information for as long as reasonably necessary to provide the service, maintain account and workspace continuity, meet legal or security obligations, resolve disputes, and enforce our agreements.",
      "We may delete or anonymize information when it is no longer reasonably needed for these purposes.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "We use reasonable administrative, technical, and organizational measures designed to protect information. However, no platform, transmission method, or storage system can be guaranteed to be completely secure, and you use the service with that understanding.",
    ],
  },
  {
    title: "Your Choices and Rights",
    paragraphs: [
      "Depending on where you live, you may have rights regarding access to, correction of, or deletion of your personal information. You may also have rights to object to certain processing or request information about how your data is used.",
      "To make a privacy-related request, contact us at hello@executionai.me. We may need to verify your identity before processing certain requests.",
    ],
  },
  {
    title: "Cookies, Sessions, and Similar Technologies",
    paragraphs: [
      "We may use cookies, local storage, session storage, and similar technologies to keep you signed in, maintain sessions, remember preferences, support product functionality, and improve reliability and performance.",
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      "Execution AI is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided personal information to us, contact us so we can review and take appropriate action.",
    ],
  },
  {
    title: "International Use",
    paragraphs: [
      "Execution AI may be accessed from multiple countries. By using the service, you understand that your information may be processed in jurisdictions different from your own, where data protection laws may differ.",
    ],
  },
  {
    title: "Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. If we make material changes, we will update the Last updated date and may provide additional notice where appropriate.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "If you have questions about this Privacy Policy or how we handle personal information, contact us at hello@executionai.me.",
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "These Terms of Use govern your access to and use of Execution AI, including our website, applications, and related services. By using Execution AI, you agree to be bound by these Terms.",
      "If you do not agree to these Terms, do not use the service.",
    ],
  },
  {
    title: "Eligibility and Accounts",
    paragraphs: [
      "You must be legally capable of entering into a binding agreement to use Execution AI. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
      "You must provide accurate information and keep your account details reasonably up to date.",
    ],
  },
  {
    title: "The Service",
    paragraphs: [
      "Execution AI is a planning and execution platform that helps users organize goals, routines, priorities, tasks, reports, and AI-assisted workflows. Features may change over time, and some features may be experimental, limited, or removed without notice.",
    ],
  },
  {
    title: "AI Features and Important Disclaimer",
    paragraphs: [
      "Execution AI may generate plans, suggestions, reports, summaries, and related outputs using artificial intelligence. These outputs are intended to support productivity and execution, not to replace your judgment.",
      "AI outputs may be incomplete, inaccurate, delayed, biased, or otherwise unsuitable for your situation. You remain solely responsible for reviewing, editing, approving, and deciding whether to rely on any AI-generated output.",
      "Execution AI does not provide medical, mental health, legal, tax, accounting, employment, financial, investment, or other professional advice.",
    ],
  },
  {
    title: "Acceptable Use",
    bullets: [
      "Do not use the service in violation of any law or regulation.",
      "Do not attempt to gain unauthorized access to accounts, systems, data, or infrastructure.",
      "Do not interfere with the security, reliability, or proper functioning of the service.",
      "Do not use the service to create, store, or distribute content that is unlawful, infringing, abusive, fraudulent, or harmful.",
      "Do not reverse engineer, scrape, or misuse the service beyond what is reasonably permitted for normal use.",
    ],
  },
  {
    title: "Your Content",
    paragraphs: [
      "You retain ownership of the content you submit to Execution AI. However, you grant us a limited, non-exclusive right to host, store, process, reproduce, and use that content as necessary to operate, maintain, improve, secure, and support the service.",
      "You are responsible for ensuring that you have the rights to submit the content you place into the service and that doing so does not violate any law or third-party rights.",
    ],
  },
  {
    title: "Intellectual Property",
    paragraphs: [
      "Execution AI, including its software, interface, workflows, brand elements, visual design, documentation, and related materials, is owned by Execution AI or its licensors and is protected by applicable intellectual property laws.",
      "Except as expressly permitted, you may not copy, modify, distribute, sell, sublicense, reverse engineer, or create derivative works from the service or its protected content.",
    ],
  },
  {
    title: "Beta Features",
    paragraphs: [
      "Some features may be marked or understood to be in beta, preview, testing, or early access. These features may be incomplete, unstable, or subject to change without notice.",
    ],
  },
  {
    title: "Termination and Suspension",
    paragraphs: [
      "We may suspend or terminate access to the service if we reasonably believe you have violated these Terms, created security or legal risk, misused the platform, or if we need to do so to protect the service, our users, or our rights.",
      "You may stop using the service at any time.",
    ],
  },
  {
    title: "Disclaimers",
    paragraphs: [
      "Execution AI is provided on an \"as is\" and \"as available\" basis to the maximum extent permitted by applicable law. We make no guarantee that the service will always be available, uninterrupted, secure, error-free, or suitable for your particular needs.",
      "We also do not guarantee that any user content, AI output, planning recommendation, report, or other result will be accurate, complete, or effective.",
    ],
  },
  {
    title: "Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by applicable law, Execution AI and its affiliates, officers, employees, contractors, and licensors will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of data, business, revenue, profits, goodwill, or opportunity arising out of or related to the service.",
      "To the maximum extent permitted by applicable law, our total liability for claims arising out of or related to the service will not exceed the greater of the amount you paid us for the service in the twelve months before the event giving rise to the claim, or one hundred United States dollars (USD $100).",
    ],
  },
  {
    title: "Indemnity",
    paragraphs: [
      "You agree to indemnify and hold harmless Execution AI and its affiliates, officers, employees, contractors, and licensors from claims, liabilities, damages, losses, and expenses arising out of or related to your misuse of the service, your content, your violation of these Terms, or your violation of any law or third-party rights.",
    ],
  },
  {
    title: "Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time. If we make material changes, we will update the Last updated date and may provide additional notice where appropriate. Your continued use of the service after updated Terms take effect constitutes acceptance of the updated Terms.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "If you have questions about these Terms, contact us at hello@executionai.me.",
    ],
  },
];
