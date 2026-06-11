import Link from "next/link";
import type { ReactNode } from "react";

type StatusPanelProps = {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function StatusPanel({ actions, description, eyebrow, title }: StatusPanelProps) {
  return (
    <section className="section section-cream">
      <div className="page-shell">
        <div className="grid max-w-3xl gap-6 border-l-4 border-editorial-red bg-editorial-white p-6 shadow-editorial">
          <div className="stack">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="text-heading-md">{title}</h1>
            <p className="text-lead text-editorial-muted">{description}</p>
          </div>
          {actions ? <div className="flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function HomeLink() {
  return (
    <Link className="editorial-button" href="/">
      Go home
    </Link>
  );
}

export function BlogLink() {
  return (
    <Link
      className="inline-flex w-fit justify-center rounded-button border border-editorial-line bg-editorial-white px-6 py-3 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
      href="/blog"
    >
      Read the blog
    </Link>
  );
}
