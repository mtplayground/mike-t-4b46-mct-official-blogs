import Link from "next/link";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-editorial-line bg-editorial-white">
      <div className="page-shell flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
        <Link
          aria-label="myClawTeam Official Blogs home"
          className="flex items-center gap-3"
          href="/"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-editorial-red font-display text-lg font-semibold text-editorial-white">
            mC
          </span>
          <span className="grid gap-1">
            <span className="font-display text-xl font-semibold leading-none text-editorial-ink">
              myClawTeam
            </span>
            <span className="text-xs font-bold uppercase leading-none tracking-[0.08em] text-editorial-muted">
              Your Professional AI Engineering Team
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap items-center gap-2">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  className="inline-flex rounded-button px-4 py-2 text-sm font-bold text-editorial-muted transition hover:bg-editorial-cream hover:text-editorial-ink focus:outline-none focus:ring-2 focus:ring-editorial-red focus:ring-offset-2"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
