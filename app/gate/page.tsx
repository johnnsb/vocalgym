import type { Metadata } from "next";
import GateForm from "@/components/GateForm";
import { sanitizeNextPath } from "@/lib/gate";

export const metadata: Metadata = {
  title: "Enter password · VocalGym",
};

export default function GatePage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const next = sanitizeNextPath(searchParams.next);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4 py-16">
      <GateForm next={next} />
    </main>
  );
}
