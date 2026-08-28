import Link from "next/link";
import { Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

/**
 * Rendered on every page. The app had no route to a human anywhere in it and
 * no link to a privacy policy, while collecting an email address on the very
 * first screen.
 *
 * The bottom padding clears the fixed nav bar on the dashboard, which is
 * pinned at bottom-4 with a 64px row.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto px-5 pt-8 pb-32 sm:pb-28 text-center">
      <div className="mx-auto max-w-md border-t border-border pt-5">
        <nav
          aria-label="Site information"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-foreground/60"
        >
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Nutri-Trust`}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Mail size={13} aria-hidden="true" /> Contact us
          </a>
        </nav>
        <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">
          A student minor project at Manipal Institute of Technology. Not medical or dietary advice.
        </p>
      </div>
    </footer>
  );
}
