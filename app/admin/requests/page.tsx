import type { Metadata } from "next";
import { expertRequestsLocation, loadExpertRequests } from "@/lib/expertRequests";

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
        <h1 className="text-2xl font-bold tracking-tight">Not authorized</h1>
        <p className="mt-2 text-sm text-slate-600">
          Append <code>?token=…</code> with your admin token.
        </p>
      </main>
    );
  }

  const requests = await loadExpertRequests();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Expert requests</h1>
      <p className="mt-1 text-sm text-slate-500">
        {requests.length} total · {expertRequestsLocation()}
        {!required && " · set USAGE_ADMIN_TOKEN to lock this page down"}
      </p>

      {requests.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No requests yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold text-slate-800">{r.name}</span>
                <a
                  href={`mailto:${r.email}`}
                  className="text-slate-600 underline"
                >
                  {r.email}
                </a>
                <span className="ml-auto text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {r.situation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
