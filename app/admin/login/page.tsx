type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const hasError = params.error === "invalid";
  const nextPath = params.next?.startsWith("/admin") ? params.next : "/admin";

  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="stack max-w-2xl">
          <p className="eyebrow">Admin</p>
          <h1 className="text-heading-md">Sign in to manage the blog.</h1>
          <p className="text-lead text-editorial-muted">
            Use the administrator credentials configured in the deployment environment.
          </p>
        </div>

        <form
          action="/api/admin/login"
          className="grid max-w-md gap-5 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial"
          method="post"
        >
          <input name="next" type="hidden" value={nextPath} />
          <label className="grid gap-2 text-sm font-bold text-editorial-ink">
            Username
            <input
              autoComplete="username"
              className="min-h-12 rounded-card border border-editorial-line px-4 text-sm font-normal outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red"
              name="username"
              required
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-editorial-ink">
            Password
            <input
              autoComplete="current-password"
              className="min-h-12 rounded-card border border-editorial-line px-4 text-sm font-normal outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red"
              name="password"
              required
              type="password"
            />
          </label>
          {hasError ? (
            <p className="rounded-card border border-editorial-red/30 bg-editorial-cream p-3 text-sm font-bold text-editorial-red">
              The username or password was not recognized.
            </p>
          ) : null}
          <button className="editorial-button" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </section>
  );
}
