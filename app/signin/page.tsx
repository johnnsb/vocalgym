import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in · VocalGym",
};

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-3 text-slate-600">
        Accounts are coming soon. For now everything works without one — your
        scripts and practice history are saved in this browser.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Back home
      </Link>
    </main>
  );
}
