import { Category, Post, PostStatus } from "@prisma/client";
import Link from "next/link";

import { createPost, updatePost } from "../actions";
import { PostUploadSizeWarning } from "./post-upload-size-warning";

type PostEditorFormProps = {
  categories: Pick<Category, "id" | "name">[];
  error?: string;
  post?: Pick<
    Post,
    | "authorAvatarKey"
    | "authorIntro"
    | "authorName"
    | "body"
    | "categoryId"
    | "coverImageKey"
    | "excerpt"
    | "id"
    | "isFeatured"
    | "slug"
    | "squareCoverImageKey"
    | "status"
    | "title"
  >;
};

function formAction(post: PostEditorFormProps["post"]) {
  return post ? updatePost : createPost;
}

export function PostEditorForm({ categories, error, post }: PostEditorFormProps) {
  const isEditing = Boolean(post);

  return (
    <form action={formAction(post)} className="grid gap-8" encType="multipart/form-data">
      {post ? <input name="postId" type="hidden" value={post.id} /> : null}

      {error ? (
        <p className="rounded-card border border-editorial-red bg-editorial-white px-5 py-4 text-sm font-bold text-editorial-red">
          {error}
        </p>
      ) : null}

      <PostUploadSizeWarning />

      <div className="grid gap-5 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial">
        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Title</span>
          <input
            className="rounded-button border border-editorial-line px-4 py-3 text-base outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.title}
            maxLength={160}
            name="title"
            required
            type="text"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Slug</span>
          <input
            className="rounded-button border border-editorial-line px-4 py-3 text-base outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.slug}
            maxLength={120}
            name="slug"
            pattern="[a-z0-9-]+"
            placeholder="generated-from-title"
            type="text"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Excerpt</span>
          <textarea
            className="min-h-28 rounded-card border border-editorial-line px-4 py-3 text-base leading-7 outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.excerpt}
            maxLength={320}
            name="excerpt"
            required
          />
        </label>
      </div>

      <div className="grid gap-5 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold uppercase text-editorial-ink">Category</span>
            <select
              className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-base outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
              defaultValue={post?.categoryId ?? categories[0]?.id}
              name="categoryId"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold uppercase text-editorial-ink">Status</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center gap-2 rounded-button border border-editorial-line px-4 py-3 text-sm font-bold">
                <input
                  className="accent-editorial-red"
                  defaultChecked={post?.status !== PostStatus.PUBLISHED}
                  name="status"
                  type="radio"
                  value={PostStatus.DRAFT}
                />
                Draft
              </label>
              <label className="flex items-center justify-center gap-2 rounded-button border border-editorial-line px-4 py-3 text-sm font-bold">
                <input
                  className="accent-editorial-red"
                  defaultChecked={post?.status === PostStatus.PUBLISHED}
                  name="status"
                  type="radio"
                  value={PostStatus.PUBLISHED}
                />
                Published
              </label>
            </div>
          </fieldset>
        </div>

        <label className="flex items-center gap-3 rounded-card border border-editorial-line bg-editorial-cream px-4 py-3 text-sm font-bold text-editorial-ink">
          <input
            className="size-4 accent-editorial-red"
            defaultChecked={post?.isFeatured ?? false}
            name="isFeatured"
            type="checkbox"
            value="yes"
          />
          Featured article
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold uppercase text-editorial-ink">
              Cover image, 16:9
            </span>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-sm"
              name="coverImage"
              type="file"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold uppercase text-editorial-ink">
              Square cover image, 1:1
            </span>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-sm"
              name="squareCoverImage"
              type="file"
            />
          </label>
        </div>
        <p className="text-sm leading-6 text-editorial-muted">
          Upload matching 16:9 and 1:1 cover images. Published posts require both cover image
          formats.
        </p>

        {post?.coverImageKey ? (
          <label className="flex items-center gap-3 text-sm text-editorial-muted">
            <input
              className="size-4 accent-editorial-red"
              name="removeCover"
              type="checkbox"
              value="yes"
            />
            Remove current cover image
          </label>
        ) : null}
        {post?.squareCoverImageKey ? (
          <label className="flex items-center gap-3 text-sm text-editorial-muted">
            <input
              className="size-4 accent-editorial-red"
              name="removeSquareCover"
              type="checkbox"
              value="yes"
            />
            Remove current square cover image
          </label>
        ) : null}
      </div>

      <div className="grid gap-5 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial">
        <div className="grid gap-2">
          <p className="text-sm font-bold uppercase text-editorial-ink">Author</p>
          <p className="text-sm leading-6 text-editorial-muted">
            Author name, intro, avatar, and cover image are required before a post can be published.
            Drafts may leave them incomplete.
          </p>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Author name</span>
          <input
            className="rounded-button border border-editorial-line px-4 py-3 text-base outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.authorName}
            maxLength={160}
            name="authorName"
            type="text"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Author intro</span>
          <textarea
            className="min-h-28 rounded-card border border-editorial-line px-4 py-3 text-base leading-7 outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.authorIntro}
            maxLength={500}
            name="authorIntro"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Author avatar</span>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-sm"
            name="authorAvatar"
            type="file"
          />
        </label>

        {post?.authorAvatarKey ? (
          <label className="flex items-center gap-3 text-sm text-editorial-muted">
            <input
              className="size-4 accent-editorial-red"
              name="removeAuthorAvatar"
              type="checkbox"
              value="yes"
            />
            Remove current author avatar
          </label>
        ) : null}
      </div>

      <div className="grid gap-5 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial">
        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Markdown body</span>
          <textarea
            className="min-h-[420px] rounded-card border border-editorial-line px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-editorial-red focus:ring-2 focus:ring-editorial-red/20"
            defaultValue={post?.body}
            name="body"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold uppercase text-editorial-ink">Inline image</span>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-sm"
            name="inlineImage"
            type="file"
          />
        </label>
        <p className="text-sm leading-6 text-editorial-muted">
          Uploaded inline images are stored privately and appended to the Markdown body as signed
          storage image references.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="editorial-button" type="submit">
          {isEditing ? "Update post" : "Create post"}
        </button>
        <Link
          className="inline-flex w-fit justify-center rounded-button border border-editorial-line bg-editorial-white px-6 py-3 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red"
          href="/admin"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
