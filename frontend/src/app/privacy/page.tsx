import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { privacySections } from "@/lib/legalContent";

export const metadata: Metadata = {
  title: "Privacy Policy | Execution AI",
  description: "How Execution AI collects, uses, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy Policy"
      title="Your data, clearly explained."
      intro="This Privacy Policy explains what information Execution AI collects, why we collect it, how we use it, and the choices available to you."
      sections={privacySections}
      aside={
        <div className="rounded-2xl bg-white px-4 py-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#6b7c75" }}>
            In plain language
          </p>
          <p className="mt-2 text-sm leading-7" style={{ color: "#475569" }}>
            Execution AI stores account information and the planning data you choose to place into the platform so it can provide planning, tracking, reporting, and AI-assisted execution features.
          </p>
        </div>
      }
    />
  );
}
