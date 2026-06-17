import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";

import { PostEditorForm } from "../../_components/post-editor-form";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function EditPostPage({ params, searchParams }: EditPostPageProps) {
  const { id } = await params;
  const [query, categories, post] = await Promise.all([
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
    prisma.post.findUnique({
      select: {
        authorAvatarKey: true,
        authorIntro: true,
        authorName: true,
        body: true,
        categoryId: true,
        coverImageKey: true,
        excerpt: true,
        id: true,
        isFeatured: true,
        slug: true,
        status: true,
        title: true,
      },
      where: {
        id,
      },
    }),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <section className="section section-cream">
      <div className="page-shell grid gap-8">
        <div className="stack max-w-2xl">
          <p className="eyebrow">Admin</p>
          <h1 className="text-heading-md">Edit post</h1>
          <p className="text-lead text-editorial-muted">
            Update post content, publication state, category placement, and storage-backed images.
          </p>
        </div>

        <PostEditorForm categories={categories} error={query?.error} post={post} />
      </div>
    </section>
  );
}
