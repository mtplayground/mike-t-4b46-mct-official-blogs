"use server";

import { PostStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { deletePostImage, uploadPostImage } from "@/lib/storage/object-storage";

type PostFormValues = {
  body: string;
  categoryId: string;
  excerpt: string;
  slug: string;
  status: PostStatus;
  title: string;
};

function redirectToAdmin(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`/admin?${query.toString()}`);
}

function redirectToEditor(path: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`${path}?${query.toString()}`);
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parsePostStatus(value: string) {
  return value === PostStatus.PUBLISHED ? PostStatus.PUBLISHED : PostStatus.DRAFT;
}

function parsePostForm(formData: FormData): PostFormValues | { error: string } {
  const title = getString(formData, "title");
  const body = getString(formData, "body");
  const categoryId = getString(formData, "categoryId");
  const excerpt = getString(formData, "excerpt");
  const slug = slugify(getString(formData, "slug") || title);
  const status = parsePostStatus(getString(formData, "status"));

  if (!title) {
    return { error: "Title is required." };
  }

  if (!slug) {
    return { error: "Slug is required." };
  }

  if (!excerpt || excerpt.length > 320) {
    return { error: "Excerpt must be between 1 and 320 characters." };
  }

  if (!body) {
    return { error: "Body content is required." };
  }

  if (!categoryId) {
    return { error: "Category is required." };
  }

  return {
    body,
    categoryId,
    excerpt,
    slug,
    status,
    title,
  };
}

function getOptionalFile(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

async function uploadImageFile(file: File) {
  return uploadPostImage({
    body: await file.arrayBuffer(),
    contentType: file.type,
    originalFilename: file.name,
  });
}

function appendInlineImage(body: string, imageKey: string, filename: string) {
  const cleanName = filename
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\[\]().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const altText = cleanName || "Inline image";

  return `${body}\n\n![${altText}](storage:${imageKey})`;
}

function publishedAtForStatus(status: PostStatus, existingPublishedAt?: Date | null) {
  return status === PostStatus.PUBLISHED ? (existingPublishedAt ?? new Date()) : null;
}

function revalidatePostViews(slug: string, previousSlug?: string) {
  revalidatePath("/admin");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/blog/${previousSlug}`);
  }
}

function uniqueErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("slug")
  ) {
    return "A post with this slug already exists.";
  }

  return null;
}

export async function createPost(formData: FormData) {
  const values = parsePostForm(formData);

  if ("error" in values) {
    redirectToEditor("/admin/posts/new", { error: values.error });
  }

  const coverImage = getOptionalFile(formData, "coverImage");
  const inlineImage = getOptionalFile(formData, "inlineImage");
  const uploadedKeys: string[] = [];
  let body = values.body;
  let coverImageKey: string | null = null;
  let createdPost: {
    slug: string;
    title: string;
  } | null = null;

  try {
    if (coverImage) {
      const uploadedCover = await uploadImageFile(coverImage);
      coverImageKey = uploadedCover.key;
      uploadedKeys.push(uploadedCover.key);
    }

    if (inlineImage) {
      const uploadedInline = await uploadImageFile(inlineImage);
      uploadedKeys.push(uploadedInline.key);
      body = appendInlineImage(body, uploadedInline.key, inlineImage.name);
    }

    createdPost = await prisma.post.create({
      data: {
        body,
        categoryId: values.categoryId,
        coverImageKey,
        excerpt: values.excerpt,
        publishedAt: publishedAtForStatus(values.status),
        slug: values.slug,
        status: values.status,
        title: values.title,
      },
      select: {
        slug: true,
        title: true,
      },
    });
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => deletePostImage(key)));

    const uniqueMessage = uniqueErrorMessage(error);
    if (uniqueMessage) {
      redirectToEditor("/admin/posts/new", { error: uniqueMessage });
    }

    console.error("Failed to create post", error);
    redirectToEditor("/admin/posts/new", { error: "Could not create the post. Try again." });
  }

  if (!createdPost) {
    redirectToEditor("/admin/posts/new", { error: "Could not create the post. Try again." });
  }

  revalidatePostViews(createdPost.slug);
  redirectToAdmin({ notice: `"${createdPost.title}" was created.` });
}

export async function updatePost(formData: FormData) {
  const postId = getString(formData, "postId");

  if (!postId) {
    redirectToAdmin({ error: "A post id is required." });
  }

  const values = parsePostForm(formData);
  const editorPath = `/admin/posts/${postId}/edit`;

  if ("error" in values) {
    redirectToEditor(editorPath, { error: values.error });
  }

  let existingPost: {
    coverImageKey: string | null;
    publishedAt: Date | null;
    slug: string;
  } | null = null;

  try {
    existingPost = await prisma.post.findUnique({
      select: {
        coverImageKey: true,
        publishedAt: true,
        slug: true,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to read post before update", error);
    redirectToEditor(editorPath, { error: "Could not update the post. Try again." });
  }

  if (!existingPost) {
    redirectToAdmin({ error: "Post not found." });
  }

  const coverImage = getOptionalFile(formData, "coverImage");
  const inlineImage = getOptionalFile(formData, "inlineImage");
  const removeCover = formData.get("removeCover") === "yes";
  const uploadedKeys: string[] = [];
  const oldCoverKey = existingPost.coverImageKey;
  let nextCoverImageKey = removeCover ? null : oldCoverKey;
  let body = values.body;
  let databaseUpdated = false;

  try {
    if (coverImage) {
      const uploadedCover = await uploadImageFile(coverImage);
      nextCoverImageKey = uploadedCover.key;
      uploadedKeys.push(uploadedCover.key);
    }

    if (inlineImage) {
      const uploadedInline = await uploadImageFile(inlineImage);
      uploadedKeys.push(uploadedInline.key);
      body = appendInlineImage(body, uploadedInline.key, inlineImage.name);
    }

    await prisma.post.update({
      data: {
        body,
        categoryId: values.categoryId,
        coverImageKey: nextCoverImageKey,
        excerpt: values.excerpt,
        publishedAt: publishedAtForStatus(values.status, existingPost.publishedAt),
        slug: values.slug,
        status: values.status,
        title: values.title,
      },
      where: {
        id: postId,
      },
    });
    databaseUpdated = true;
  } catch (error) {
    if (!databaseUpdated) {
      await Promise.allSettled(uploadedKeys.map((key) => deletePostImage(key)));
    }

    const uniqueMessage = uniqueErrorMessage(error);
    if (uniqueMessage) {
      redirectToEditor(editorPath, { error: uniqueMessage });
    }

    console.error("Failed to update post", error);
    redirectToEditor(editorPath, { error: "Could not update the post. Try again." });
  }

  if (oldCoverKey && oldCoverKey !== nextCoverImageKey) {
    try {
      await deletePostImage(oldCoverKey);
    } catch (error) {
      console.error("Failed to delete replaced cover image", error);
    }
  }

  revalidatePostViews(values.slug, existingPost.slug);
  redirectToAdmin({ notice: `"${values.title}" was updated.` });
}
