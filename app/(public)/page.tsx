export default function HomePage() {
  return (
    <main>
      <section className="section section-cream">
        <div className="page-shell grid gap-10 md:grid-cols-[1fr_360px] md:items-center">
          <div className="stack">
            <p className="eyebrow">myClawTeam Official Blogs</p>
            <h1 className="text-heading-lg">Editorial publishing foundation</h1>
            <p className="max-w-2xl text-lead text-editorial-muted">
              The public blog route group is ready for the editorial home page, post listings, and
              individual article pages.
            </p>
            <a className="editorial-button" href="/blog">
              View blog route
            </a>
          </div>
          <aside className="feature-card">
            <p className="eyebrow">Design Tokens</p>
            <h2 className="mt-4 text-heading-sm text-editorial-white">Dark feature-card surface</h2>
            <p className="feature-card-muted mt-3">
              Tailwind now exposes the cream bands, red accent, display scale, and rounded CTA
              tokens for later issues.
            </p>
          </aside>
        </div>
      </section>
      <section className="section section-white">
        <div className="page-shell stack">
          <p className="eyebrow">myClawTeam Official Blogs</p>
          <h2 className="text-heading-md">White section band</h2>
          <p className="max-w-2xl text-lead text-editorial-muted">
            This route remains a scaffold while the shared layout and home page are built in later
            issues.
          </p>
        </div>
      </section>
    </main>
  );
}
