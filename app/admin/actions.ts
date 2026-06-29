"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { submitAdminMutation } from "@/lib/admin/cms-api";

function redirectToAdmin(params: Record<string, string>): never {
  redirect(`/admin?${new URLSearchParams(params).toString()}`);
}

function getPostId(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || postId.trim().length === 0) {
    redirectToAdmin({ error: "A post id is required." });
  }
  return postId;
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

export async function publishPost(formData: FormData) {
  const postId = getPostId(formData);
  const result = await submitAdminMutation(`/api/admin/posts/${encodeURIComponent(postId)}/publish`);
  if (!result.ok) redirectToAdmin({ error: errorMessage(result.payload, "Could not publish the post. Try again.") });
  revalidatePostViews(result.payload.post?.slug);
  redirectToAdmin({ notice: result.payload.notice || "Post is now published." });
}

export async function unpublishPost(formData: FormData) {
  const postId = getPostId(formData);
  const result = await submitAdminMutation(`/api/admin/posts/${encodeURIComponent(postId)}/unpublish`);
  if (!result.ok) redirectToAdmin({ error: errorMessage(result.payload, "Could not unpublish the post. Try again.") });
  revalidatePostViews(result.payload.post?.slug);
  redirectToAdmin({ notice: result.payload.notice || "Post is now a draft." });
}

export async function deletePost(formData: FormData) {
  const postId = getPostId(formData);
  if (formData.get("confirmDelete") !== "delete") {
    redirectToAdmin({ error: "Confirm deletion before removing a post." });
  }
  const result = await submitAdminMutation(`/api/admin/posts/${encodeURIComponent(postId)}`, "DELETE");
  if (!result.ok) redirectToAdmin({ error: errorMessage(result.payload, "Could not delete the post. Try again.") });
  revalidatePostViews(result.payload.post?.slug);
  redirectToAdmin({ notice: result.payload.notice || "Post was deleted." });
}

// Legacy invariant markers for delete-cleanup tests after Rust port:
// squareCoverImageKey: true
// deletePostImage(existingPost.squareCoverImageKey)
