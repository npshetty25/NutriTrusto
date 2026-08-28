import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

const LAST_UPDATED = "11 August 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What personal information Nutri-Trust collects, why it is collected, which third parties process it, and how to request access or deletion.",
  alternates: { canonical: "/privacy" },
};

function Section({ id, heading, children }: { id: string; heading: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-9">
      <h2 className="text-lg font-bold tracking-tight mb-2">{heading}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="px-5 py-10 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors mb-7"
      >
        <ArrowLeft size={14} /> Back to Nutri-Trust
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-foreground/60">Last updated {LAST_UPDATED}</p>

      <div className="neu-raised rounded-2xl p-4 mt-6 text-[15px] leading-relaxed text-foreground/80">
        Nutri-Trust is a free web application built as an undergraduate minor project at Manipal
        Institute of Technology. It is not a commercial product and there is no company behind it.
        It is operated by the student project team named at the end of this page. This policy
        describes what the app actually does with your information, in plain language.
      </div>

      <Section id="what-we-collect" heading="What is collected">
        <p>
          <strong className="text-foreground">Account details.</strong> Your email address, a
          password, the name you enter, and the dietary preference you choose (vegetarian,
          eggtarian or non-vegetarian). Passwords are handled by our authentication provider and
          stored hashed; the project team never sees them.
        </p>
        <p>
          <strong className="text-foreground">Your pantry.</strong> The names of items you add,
          their purchase and expiry dates, and where available the ingredient text and nutrition
          score returned for a scanned product. Also your shopping list, your scan history, and a
          record of whether each item was used or thrown away, which is what the impact dashboard is
          calculated from.
        </p>
        <p>
          <strong className="text-foreground">Household membership.</strong> If you create or join a
          household, the household name, its invite code, and which accounts belong to it. Members
          of the same household can see the shared pantry.
        </p>
        <p>
          <strong className="text-foreground">Images you upload.</strong> Photos of receipts,
          nutrition labels and expiry dates. These are sent for automated text extraction and are
          not retained by us after the text is extracted.
        </p>
        <p>
          <strong className="text-foreground">On your device.</strong> Your light or dark theme
          choice, and markers recording which expiry reminders have already been shown, both stored
          in your browser&apos;s local storage. These never leave your device.
        </p>
        <p>
          There is no advertising, no analytics or tracking script, and no third-party cookie on
          this site.
        </p>
      </Section>

      <Section id="why" heading="Why it is collected">
        <p>
          Every item above exists to make one of the app&apos;s features work: to sign you in, to
          show you what is in your pantry and when it expires, to warn you before something spoils,
          to generate a recipe from what you already have, and to share a pantry with your
          household. None of it is collected for any other purpose, and none of it is sold or used
          for advertising.
        </p>
      </Section>

      <Section id="third-parties" heading="Who else processes it">
        <p>
          The app depends on the following services. Each has its own privacy policy, and your data
          is subject to it while that service is handling it.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Supabase</strong> — stores your account and all
            pantry data, and handles sign-in.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — hosts the application and keeps
            standard server request logs.
          </li>
          <li>
            <strong className="text-foreground">Google (Gemini API)</strong> — receives the images
            you upload for text extraction, and the names of your pantry items when you request a
            recipe or ask the in-app assistant a question. It does not receive your email or name.
          </li>
          <li>
            <strong className="text-foreground">Open Food Facts</strong> and{" "}
            <strong className="text-foreground">UPCitemdb</strong> — receive the barcode number you
            scan, in order to look the product up. They do not receive anything identifying you.
          </li>
        </ul>
        <p>
          If you explicitly choose to contribute a corrected product back to Open Food Facts, that
          product information becomes part of their public open database. This is off by default and
          happens only when you ask for it.
        </p>
      </Section>

      <Section id="retention" heading="How long it is kept">
        <p>
          Pantry items, shopping list entries and scan history are kept until you delete them or
          delete your account. Uploaded images are not stored after text extraction. Because this is
          a student project running on free hosting tiers, the service may be paused or withdrawn
          after the academic project concludes; if that happens, the stored data is deleted with it.
        </p>
      </Section>

      <Section id="your-rights" heading="Your rights">
        <p>
          India&apos;s Digital Personal Data Protection Act, 2023 gives you the right to ask what
          personal data is held about you, to have it corrected, and to have it erased. You can
          delete individual pantry items in the app at any time. For anything else — a copy of your
          data, a correction, or full deletion of your account — email the address below and we will
          act on it.
        </p>
        <p>If you are outside India, the same requests are honoured regardless of where you are.</p>
      </Section>

      <Section id="security" heading="Security, honestly stated">
        <p>
          Every table is protected by row-level security, so one account cannot read another
          account&apos;s data, and traffic is encrypted in transit. That said, this is a student
          project, not an audited commercial service, and it should be treated as such.
        </p>
        <p>
          <strong className="text-foreground">Please do not enter sensitive health information.</strong>{" "}
          The app asks only for a dietary preference. It has no field for medical conditions, and
          none should be typed into item names or the assistant.
        </p>
      </Section>

      <Section id="children" heading="Children">
        <p>
          The app is not directed at children under 18 and we do not knowingly collect their
          personal data. If you believe a child has created an account, email us and it will be
          removed.
        </p>
      </Section>

      <Section id="changes" heading="Changes to this policy">
        <p>
          If this policy changes, the date at the top of the page changes with it. The current
          version is always the one published here.
        </p>
      </Section>

      <Section id="contact" heading="Contact">
        <p>
          For any question about this policy, or to request access, correction or deletion of your
          data, contact the project team:
        </p>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Nutri-Trust%20privacy%20request`}
            className="font-semibold text-brand underline underline-offset-2 break-all"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-sm text-foreground/60">
          Nutri-Trust student project team — Nirav P Shetty, Prisha Malhotra, Sumit Kumar Chourasia
          and Abhyuday Verma. Department of Humanities and Management, Manipal Institute of
          Technology, Manipal, Karnataka 576104, India.
        </p>
      </Section>
    </main>
  );
}
