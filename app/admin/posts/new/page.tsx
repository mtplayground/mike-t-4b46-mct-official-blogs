import { prisma } from "@/lib/db/prisma";

import { PostEditorForm } from "../_components/post-editor-form";

type NewPostPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewPostPage({ searchParams }: NewPostPageProps) {
  const [params, categories] = await Promise.all([
    searchParams,
    prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="stack max-w-2xl">
          <p className="eyebrow">Admin</p>
          <h1 className="text-heading-md">Create post</h1>
          <p className="text-lead text-editorial-muted">
            Draft or publish a new official blog post with Markdown content and private object
            storage images.
          </p>
        </div>

        <PostEditorForm categories={categories} error={params?.error} />
      </div>
    </section>
  );
}
