import { PostStatus, type Post } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/db/prisma";

import { deletePost, publishPost, unpublishPost } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

type AdminPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

type AdminPost = Post & {
  category: {
    name: string;
  };
};

function formatDate(date: Date | null) {
  return date ? dateFormatter.format(date) : "Unscheduled";
}

function statusLabel(status: PostStatus) {
  return status === PostStatus.PUBLISHED ? "Published" : "Draft";
}

function StatusBadge({ status }: { status: PostStatus }) {
  const isPublished = status === PostStatus.PUBLISHED;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${
        isPublished
          ? "bg-editorial-red text-editorial-white"
          : "bg-editorial-cream text-editorial-muted"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function PublishControls({ post }: { post: AdminPost }) {
  if (post.status === PostStatus.PUBLISHED) {
    return (
      <form action={unpublishPost}>
        <input name="postId" type="hidden" value={post.id} />
        <button
          className="inline-flex w-full justify-center rounded-button border border-editorial-line bg-editorial-white px-4 py-2 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
          type="submit"
        >
          Unpublish
        </button>
      </form>
    );
  }

  return (
    <form action={publishPost}>
      <input name="postId" type="hidden" value={post.id} />
      <button className="editorial-button w-full px-4 py-2" type="submit">
        Publish
      </button>
    </form>
  );
}

function DeleteControl({ post }: { post: AdminPost }) {
  return (
    <details className="rounded-card border border-editorial-line bg-editorial-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-editorial-red">Delete</summary>
      <form action={deletePost} className="mt-4 grid gap-4">
        <input name="postId" type="hidden" value={post.id} />
        <label className="flex items-start gap-3 text-sm text-editorial-muted">
          <input
            className="mt-1 size-4 accent-editorial-red"
            name="confirmDelete"
            required
            type="checkbox"
            value="delete"
          />
          <span>Confirm permanent deletion of this post.</span>
        </label>
        <button
          className="inline-flex w-full justify-center rounded-button bg-editorial-dark-card px-4 py-2 text-sm font-bold text-editorial-white transition hover:bg-editorial-ink"
          type="submit"
        >
          Delete post
        </button>
      </form>
    </details>
  );
}

function PostRow({ post }: { post: AdminPost }) {
  return (
    <article className="grid gap-5 rounded-card border border-editorial-line bg-editorial-white p-5 shadow-editorial lg:grid-cols-[1fr_260px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={post.status} />
          <span className="text-xs font-bold uppercase text-editorial-red">
            {post.category.name}
          </span>
        </div>
        <div className="grid gap-2">
          <h2 className="text-2xl font-semibold">{post.title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-editorial-muted">{post.excerpt}</p>
        </div>
        <dl className="grid gap-3 text-sm text-editorial-muted sm:grid-cols-3">
          <div>
            <dt className="font-bold uppercase text-editorial-ink">Slug</dt>
            <dd className="break-all">{post.slug}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase text-editorial-ink">Published</dt>
            <dd>{formatDate(post.publishedAt)}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase text-editorial-ink">Updated</dt>
            <dd>{formatDate(post.updatedAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="grid content-start gap-3">
        <Link
          className="inline-flex justify-center rounded-button border border-editorial-line bg-editorial-white px-4 py-2 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
          href={`/admin/posts/${post.id}/edit`}
        >
          Edit
        </Link>
        <PublishControls post={post} />
        {post.status === PostStatus.PUBLISHED ? (
          <Link
            className="inline-flex justify-center rounded-button border border-editorial-line bg-editorial-white px-4 py-2 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
            href={`/blog/${post.slug}`}
          >
            View post
          </Link>
        ) : null}
        <DeleteControl post={post} />
      </div>
    </article>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const posts = await prisma.post.findMany({
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  const publishedCount = posts.filter((post) => post.status === PostStatus.PUBLISHED).length;
  const draftCount = posts.length - publishedCount;

  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="stack max-w-2xl">
            <p className="eyebrow">Admin</p>
            <h1 className="text-heading-md">Post dashboard</h1>
            <p className="text-lead text-editorial-muted">
              Review every draft and published post, adjust publishing status, and remove posts that
              should no longer appear in the official blog.
            </p>
          </div>
          <form action="/api/admin/logout" method="post">
            <button
              className="inline-flex rounded-button border border-editorial-line bg-editorial-white px-5 py-3 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>

        <Link className="editorial-button" href="/admin/posts/new">
          New post
        </Link>

        {params?.notice ? (
          <p className="rounded-card border border-editorial-line bg-editorial-white px-5 py-4 text-sm font-bold text-editorial-ink">
            {params.notice}
          </p>
        ) : null}
        {params?.error ? (
          <p className="rounded-card border border-editorial-red bg-editorial-white px-5 py-4 text-sm font-bold text-editorial-red">
            {params.error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="feature-card">
            <p className="text-sm font-bold uppercase text-editorial-dark-card-muted">Total</p>
            <p className="mt-3 text-4xl font-semibold">{posts.length}</p>
          </div>
          <div className="feature-card">
            <p className="text-sm font-bold uppercase text-editorial-dark-card-muted">Published</p>
            <p className="mt-3 text-4xl font-semibold">{publishedCount}</p>
          </div>
          <div className="feature-card">
            <p className="text-sm font-bold uppercase text-editorial-dark-card-muted">Drafts</p>
            <p className="mt-3 text-4xl font-semibold">{draftCount}</p>
          </div>
        </div>

        {posts.length > 0 ? (
          <div className="grid gap-4">
            {posts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-editorial-line bg-editorial-white p-8 shadow-editorial">
            <p className="eyebrow">No posts</p>
            <p className="mt-3 text-lg text-editorial-muted">
              Posts will appear here after they are created.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
