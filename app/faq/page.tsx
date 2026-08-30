import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ · VocalGym",
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">FAQ</h1>
      <p className="mt-3 text-slate-600">
        We&apos;re still writing these up. In the meantime — nothing is saved to
        an account (there aren&apos;t accounts yet), your scripts and past
        attempts live only in this browser, and any webcam analysis happens on
        your device.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/generate"
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
        >
          Write a script
        </Link>
        <Link
          href="/script"
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Bring your own
        </Link>
      </div>
    </main>
  );
}
