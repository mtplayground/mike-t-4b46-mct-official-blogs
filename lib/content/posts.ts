export enum PostStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
}

export enum CategorySlug {
  THOUGHTS = "THOUGHTS",
  PRODUCT_PROGRESS = "PRODUCT_PROGRESS",
  ANNOUNCEMENTS = "ANNOUNCEMENTS",
}

export type PostVisibilityFields = { publishedAt: Date | string | null; status: PostStatus };
export type PublishedPostRequirementFields = {
  authorAvatarKey: string | null;
  authorIntro: string;
  authorName: string;
  companyIntro: string;
  companyLogoKey?: string | null;
  companyName: string;
  coverImageKey: string | null;
};

export function isPublishedPostVisible(post: PostVisibilityFields) {
  return post.status === PostStatus.PUBLISHED && post.publishedAt !== null;
}

export function hasPublishedPostRequiredFields(post: PublishedPostRequirementFields) {
  return Boolean(
    post.authorAvatarKey &&
    post.authorIntro.trim() &&
    post.authorName.trim() &&
    post.companyIntro.trim() &&
    post.companyName.trim() &&
    post.coverImageKey,
  );
}

export function publishedPostWhere(activeCategory?: CategorySlug) {
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
