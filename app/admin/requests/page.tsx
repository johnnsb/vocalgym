import type { Metadata } from "next";
import { expertRequestsLocation, loadExpertRequests } from "@/lib/expertRequests";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Expert requests · admin" };
export const dynamic = "force-dynamic";

// Bare list of submitted "get expert help" requests, for manual fulfilment.
// Gated by USAGE_ADMIN_TOKEN when that's set (`?token=…`); open otherwise.
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const required = process.env.USAGE_ADMIN_TOKEN;
  if (required && searchParams.token !== required) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-h3 text-text-primary">Not authorized</h1>
        <p className="mt-2 text-body-sm text-text-body">
          Append <code>?token=…</code> with your admin token.
        </p>
      </main>
    );
  }

  const requests = await loadExpertRequests();

  return (
    <main className="mx-auto max-w-container px-4 py-12 sm:px-8">
      <h1 className="font-serif text-h2 text-text-primary">Expert requests</h1>
      <p className="mt-1 text-body-sm text-text-muted">
        {requests.length} total · {expertRequestsLocation()}
        {!required && " · set USAGE_ADMIN_TOKEN to lock this page down"}
      </p>

      {requests.length === 0 ? (
        <p className="mt-8 text-body-sm text-text-muted">No requests yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {requests.map((r) => (
            <Card key={r.id} as="li" padding="sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body-sm">
                <span className="font-semibold text-text-primary">{r.name}</span>
                <a
                  href={`mailto:${r.email}`}
                  className="text-text-body underline"
                >
                  {r.email}
                </a>
                <span className="ml-auto text-caption text-text-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-body-sm leading-relaxed text-text-body">
                {r.situation}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
