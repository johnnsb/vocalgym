import Link from "next/link";
import { Button } from "@/components/ui";

// The marketing site's sticky translucent bar (the app itself uses no top bar,
// but VocalGym keeps one nav across every route). Wordmark is text until the
// brand PNGs land in /public/brand (see public/brand/README.md) — swap to
// <BrandMark variant="lockup" /> then.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-[rgba(250,247,241,0.86)] backdrop-blur-[14px] backdrop-saturate-150">
      <nav className="mx-auto flex h-[var(--topbar-h)] max-w-container items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          className="font-serif text-h4 font-semibold tracking-tight text-text-primary no-underline"
        >
          VocalGym
        </Link>
        <div className="flex items-center gap-1 text-body-sm sm:gap-3">
          <Link
            href="/how-it-works"
            className="rounded-sm px-2 py-1.5 text-text-body no-underline transition-colors hover:text-text-primary"
          >
            How it works
          </Link>
          <Link
            href="/faq"
            className="rounded-sm px-2 py-1.5 text-text-body no-underline transition-colors hover:text-text-primary"
          >
            FAQ
          </Link>
          <Button as={Link} href="/signin" variant="secondary" size="sm">
            Sign in
          </Button>
        </div>
      </nav>
    </header>
  );
}
