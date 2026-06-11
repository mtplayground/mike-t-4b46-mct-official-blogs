"use server";

import { PostStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { deletePostImage } from "@/lib/storage/object-storage";

function redirectToAdmin(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`/admin?${query.toString()}`);
}

function getPostId(formData: FormData) {
  const postId = formData.get("postId");

  if (typeof postId !== "string" || postId.trim().length === 0) {
    redirectToAdmin({ error: "A post id is required." });
  }

  return postId;
}

function revalidatePostViews(slug: string) {
  revalidatePath("/admin");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
}

export async function publishPost(formData: FormData) {
  const postId = getPostId(formData);
  let existingPost: {
    publishedAt: Date | null;
    slug: string;
    title: string;
  } | null = null;

  try {
    existingPost = await prisma.post.findUnique({
      select: {
        publishedAt: true,
        slug: true,
        title: true,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to read post before publish", error);
    redirectToAdmin({ error: "Could not publish the post. Try again." });
  }

  if (!existingPost) {
    redirectToAdmin({ error: "Post not found." });
  }

  try {
    await prisma.post.update({
      data: {
        publishedAt: existingPost.publishedAt ?? new Date(),
        status: PostStatus.PUBLISHED,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to publish post", error);
    redirectToAdmin({ error: "Could not publish the post. Try again." });
  }

  revalidatePostViews(existingPost.slug);
  redirectToAdmin({ notice: `"${existingPost.title}" is now published.` });
}

export async function unpublishPost(formData: FormData) {
  const postId = getPostId(formData);
  let existingPost: {
    slug: string;
    title: string;
  } | null = null;

  try {
    existingPost = await prisma.post.findUnique({
      select: {
        slug: true,
        title: true,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to read post before unpublish", error);
    redirectToAdmin({ error: "Could not unpublish the post. Try again." });
  }

  if (!existingPost) {
    redirectToAdmin({ error: "Post not found." });
  }

  try {
    await prisma.post.update({
      data: {
        publishedAt: null,
        status: PostStatus.DRAFT,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to unpublish post", error);
    redirectToAdmin({ error: "Could not unpublish the post. Try again." });
  }

  revalidatePostViews(existingPost.slug);
  redirectToAdmin({ notice: `"${existingPost.title}" is now a draft.` });
}

export async function deletePost(formData: FormData) {
  const postId = getPostId(formData);
  const confirmation = formData.get("confirmDelete");

  if (confirmation !== "delete") {
    redirectToAdmin({ error: "Confirm deletion before removing a post." });
  }

  let existingPost: {
    coverImageKey: string | null;
    slug: string;
    title: string;
  } | null = null;

  try {
    existingPost = await prisma.post.findUnique({
      select: {
        coverImageKey: true,
        slug: true,
        title: true,
      },
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to read post before delete", error);
    redirectToAdmin({ error: "Could not delete the post. Try again." });
  }

  if (!existingPost) {
    redirectToAdmin({ error: "Post not found." });
  }

  try {
    if (existingPost.coverImageKey) {
      await deletePostImage(existingPost.coverImageKey);
    }

    await prisma.post.delete({
      where: {
        id: postId,
      },
    });
  } catch (error) {
    console.error("Failed to delete post", error);
    redirectToAdmin({ error: "Could not delete the post. Try again." });
  }

  revalidatePostViews(existingPost.slug);
  redirectToAdmin({ notice: `"${existingPost.title}" was deleted.` });
}
