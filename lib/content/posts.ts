import { CategorySlug, PostStatus, type Post, type Prisma } from "@prisma/client";

export type PostVisibilityFields = Pick<Post, "publishedAt" | "status">;
export type PublishedPostRequirementFields = Pick<
  Post,
  "authorAvatarKey" | "authorIntro" | "authorName" | "coverImageKey"
>;

export function isPublishedPostVisible(post: PostVisibilityFields) {
  return post.status === PostStatus.PUBLISHED && post.publishedAt !== null;
}

export function hasPublishedPostRequiredFields(post: PublishedPostRequirementFields) {
  return Boolean(
    post.authorAvatarKey && post.authorIntro.trim() && post.authorName.trim() && post.coverImageKey,
  );
}

export function publishedPostWhere(activeCategory?: CategorySlug): Prisma.PostWhereInput {
  return {
    publishedAt: {
      not: null,
    },
    status: PostStatus.PUBLISHED,
    ...(activeCategory
      ? {
          category: {
            slug: activeCategory,
          },
        }
      : {}),
  };
}
