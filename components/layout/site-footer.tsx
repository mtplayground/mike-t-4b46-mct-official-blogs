import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/admin", label: "Admin" },
];

const categoryLabels = ["Thoughts", "Product Progress", "Announcements"];

export function SiteFooter() {
  return (
    <footer className="bg-editorial-dark-card text-editorial-white">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="stack">
          <Link
            aria-label="myClawTeam Official Blogs home"
            className="flex items-center gap-3"
            href="/"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-editorial-red font-display text-base font-semibold text-editorial-white">
              mC
            </span>
            <span className="grid gap-1">
              <span className="font-display text-xl font-semibold leading-none">myClawTeam</span>
              <span className="text-xs font-bold uppercase leading-none tracking-[0.08em] text-editorial-dark-card-muted">
                Your Professional AI Engineering Team
              </span>
            </span>
          </Link>
          <p className="max-w-md text-sm leading-6 text-editorial-dark-card-muted">
            Official updates, product progress, and engineering notes from myClawTeam.
          </p>
        </div>

        <div className="stack gap-4">
          <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-editorial-white">
            Explore
          </h2>
          <ul className="grid gap-3 text-sm text-editorial-dark-card-muted">
            {footerLinks.map((item) => (
              <li key={item.href}>
                <Link className="transition hover:text-editorial-white" href={item.href}>
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
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-5 text-xs text-editorial-dark-card-muted md:flex-row md:items-center md:justify-between">
          <p>Copyright 2026 myClawTeam. All rights reserved.</p>
          <p>Built for clear, practical AI engineering updates.</p>
        </div>
      </div>
    </footer>
  );
}
