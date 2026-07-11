import Link from "next/link";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/admin/login", label: "Admin" },
  {
    external: true,
    href: "https://myclawteam.ai",
    label: "Official Website",
  },
];

const navItemClassName =
  "inline-flex rounded-button px-4 py-2 text-sm font-bold text-editorial-muted transition hover:bg-editorial-cream hover:text-editorial-ink focus:outline-none focus:ring-2 focus:ring-editorial-red focus:ring-offset-2";

export function SiteHeader() {
  return (
    <header className="border-b border-editorial-line bg-editorial-white">
      <div className="page-shell flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
        <Link prefetch={false}
          aria-label="myClawTeam Blog home"
          className="flex items-center gap-3"
          href="/"
        >
          <img
            alt="myClawTeam Blog"
            className="h-11 w-auto"
            src="https://myclawteam.ai/logo.png"
          />
          <span className="grid gap-1">
            <span className="font-sans text-xl font-semibold leading-none text-editorial-ink">
              myClawTeam Blog
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap items-center gap-2">
            {navigation.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    className={navItemClassName}
                    href={item.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link prefetch={false} className={navItemClassName} href={item.href}>
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
