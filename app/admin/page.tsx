export default function AdminPage() {
  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="stack max-w-2xl">
          <p className="eyebrow">Admin</p>
          <h1 className="text-heading-md">Blog administration</h1>
          <p className="text-lead text-editorial-muted">
            You are signed in. Post management and subscriber tools will appear here as the admin
            workflow is built.
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button className="editorial-button" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
