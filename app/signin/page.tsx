import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign in · VocalGym",
};

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-serif text-h2 text-text-primary">Sign in</h1>
      <p className="mx-auto mt-3 max-w-prose text-body text-text-body">
        Accounts are coming soon. For now everything works without one — your
        scripts and practice history are tied to an anonymous session in this
        browser.
      </p>
      <div className="mt-6 flex justify-center">
        <Button as={Link} href="/" variant="primary">
          Back home
        </Button>
      </div>
    </main>
  );
}
