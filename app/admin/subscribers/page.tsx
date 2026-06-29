import Link from "next/link";

import { getAdminSubscribers } from "@/lib/admin/cms-api";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric",
});

function formatSignupDate(date: string) {
  return dateFormatter.format(new Date(date));
}

export default async function SubscribersPage() {
  const subscribers = await getAdminSubscribers();

  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="stack max-w-2xl">
            <p className="eyebrow">Admin</p>
            <h1 className="text-heading-md">Newsletter subscribers</h1>
            <p className="text-lead text-editorial-muted">
              Review collected newsletter signups with each subscriber email and UTC signup date.
            </p>
          </div>
          <Link
            className="inline-flex w-fit justify-center rounded-button border border-editorial-line bg-editorial-white px-5 py-3 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
            href="/admin"
          >
            Back to posts
          </Link>
        </div>

        <div className="feature-card w-fit min-w-48">
          <p className="text-sm font-bold uppercase text-editorial-dark-card-muted">Subscribers</p>
          <p className="mt-3 text-4xl font-semibold">{subscribers.length}</p>
        </div>

        {subscribers.length > 0 ? (
          <div className="overflow-hidden rounded-card border border-editorial-line bg-editorial-white shadow-editorial">
            <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 border-b border-editorial-line px-5 py-4 text-xs font-bold uppercase text-editorial-muted">
              <span>Email</span>
              <span>Signup date</span>
            </div>
            <div className="divide-y divide-editorial-line">
              {subscribers.map((subscriber) => (
                <article
                  className="grid grid-cols-1 gap-2 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-4"
                  key={subscriber.id}
                >
                  <a
                    className="break-all font-bold text-editorial-ink transition hover:text-editorial-red"
                    href={`mailto:${subscriber.email}`}
                  >
                    {subscriber.email}
                  </a>
                  <time
                    className="text-editorial-muted"
                    dateTime={subscriber.createdAt}
                  >
                    {formatSignupDate(subscriber.createdAt)}
                  </time>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-editorial-line bg-editorial-white p-8 shadow-editorial">
            <p className="eyebrow">No subscribers</p>
            <p className="mt-3 text-lg text-editorial-muted">
              Newsletter signups will appear here after readers subscribe from the footer form.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
