import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          VocalGym
        </Link>
        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/how-it-works"
            className="rounded-md px-2 py-1.5 text-slate-600 transition hover:text-slate-900"
          >
            How it works
          </Link>
          <Link
            href="/faq"
            className="rounded-md px-2 py-1.5 text-slate-600 transition hover:text-slate-900"
          >
            FAQ
          </Link>
          <Link
            href="/signin"
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
