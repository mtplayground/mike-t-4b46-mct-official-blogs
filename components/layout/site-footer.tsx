import Link from "next/link";

import { NewsletterSignupForm } from "@/components/newsletter/newsletter-signup-form";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/admin/login", label: "Admin" },
];

const categoryLabels = ["Thoughts", "Product Progress", "Announcements"];

export function SiteFooter() {
  return (
    <footer className="bg-editorial-dark-card text-editorial-white">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.2fr_0.8fr_0.9fr_1.35fr]">
        <div className="stack">
          <Link
            aria-label="myClawTeam Blog home"
            className="flex items-center gap-3"
            href="/"
          >
            <img
              alt="myClawTeam Blog"
              className="h-10 w-auto"
              src="https://myclawteam.ai/logo.png"
            />
            <span className="grid gap-1">
              <span className="font-display text-xl font-semibold leading-none">
                myClawTeam Blog
              </span>
              <span className="text-xs font-bold uppercase leading-none tracking-[0.08em] text-editorial-dark-card-muted">
                Official updates and engineering notes
              </span>
            </span>
          </Link>
          <p className="max-w-md text-sm leading-6 text-editorial-dark-card-muted">
            The official home for myClawTeam product progress, announcements, and practical
            engineering notes.
          </p>
        </div>

        <div className="stack gap-4">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-editorial-white">
            Explore
          </h2>
          <ul className="grid gap-3 text-sm text-editorial-dark-card-muted">
            {footerLinks.map((item) => (
              <li key={item.href}>
                <Link
                  className="transition hover:text-editorial-white"
                  href={item.href}
                  prefetch={false}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="stack gap-4">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-editorial-white">
            Categories
          </h2>
          <ul className="grid gap-3 text-sm text-editorial-dark-card-muted">
            {categoryLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>

        <div className="stack gap-4">
          <div className="grid gap-3">
            <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-editorial-white">
              Stay in the Loop
            </h2>
            <p className="text-sm leading-6 text-editorial-dark-card-muted">
              Get new posts from myClawTeam Blog in your inbox.
            </p>
          </div>
          <NewsletterSignupForm />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-5 text-xs text-editorial-dark-card-muted md:flex-row md:items-center md:justify-between">
          <p>© 2026 myClawTeam. All rights reserved.</p>
          <p>Official updates for clear, practical AI engineering.</p>
        </div>
      </div>
    </footer>
  );
}
