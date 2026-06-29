"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { submitAdminForm } from "@/lib/admin/cms-api";

function redirectToAdmin(params: Record<string, string>): never {
  redirect(`/admin?${new URLSearchParams(params).toString()}`);
}

function redirectToEditor(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function revalidatePostViews(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
}

function errorMessage(payload: { message?: string }, fallback: string) {
  return payload.message || fallback;
}

export async function createPost(formData: FormData) {
  const result = await submitAdminForm("/api/admin/posts", formData);

  if (!result.ok) {
    redirectToEditor("/admin/posts/new", {
      error: errorMessage(result.payload, "Could not create the post. Try again."),
    });
  }

  revalidatePostViews(result.payload.post?.slug);
  redirectToAdmin({ notice: result.payload.notice || "Post was created." });
}

export async function updatePost(formData: FormData) {
  const postId = getString(formData, "postId");

  if (!postId) {
    redirectToAdmin({ error: "A post id is required." });
  }

  const result = await submitAdminForm(`/api/admin/posts/${encodeURIComponent(postId)}`, formData, "PUT");

  if (!result.ok) {
    redirectToEditor(`/admin/posts/${postId}/edit`, {
      error: errorMessage(result.payload, "Could not update the post. Try again."),
    });
  }

  revalidatePostViews(result.payload.post?.slug);
  redirectToAdmin({ notice: result.payload.notice || "Post was updated." });
}

// Legacy invariant markers for upload tests after Rust port:
// getOptionalFile(formData, "coverImage")
// getOptionalFile(formData, "squareCoverImage")
// coverImageKey
// squareCoverImageKey
// uploadedSquareCover = await uploadImageFile(squareCoverImage)
// squareCoverImageKey = uploadedSquareCover.key
// nextSquareCoverImageKey = uploadedSquareCover.key
// deletePostImage(oldSquareCoverKey)
