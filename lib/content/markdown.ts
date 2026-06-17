import { getSignedPostImageUrl } from "@/lib/storage/object-storage";

export type MarkdownImageSigner = (relativeKey: string) => Promise<string>;

const STORAGE_IMAGE_PATTERN = /!\[([^\]]*)\]\(storage:([^\s)]+)([^)]*)\)/g;

async function signStorageImageReference(
  reference: string,
  altText: string,
  relativeKey: string,
  suffix: string,
  signer: MarkdownImageSigner,
) {
  try {
    const signedUrl = await signer(relativeKey);

    return `![${altText}](${signedUrl}${suffix})`;
  } catch (error) {
    console.error("Failed to sign Markdown storage image", error);

    return reference;
  }
}

export async function getSignedMarkdownBody(
  body: string,
  signer: MarkdownImageSigner = getSignedPostImageUrl,
) {
  const matches = [...body.matchAll(STORAGE_IMAGE_PATTERN)];

  if (matches.length === 0) {
    return body;
  }

  const replacements = await Promise.all(
    matches.map((match) =>
      signStorageImageReference(match[0], match[1], match[2], match[3] ?? "", signer),
    ),
  );

  let replacementIndex = 0;

  return body.replace(STORAGE_IMAGE_PATTERN, () => replacements[replacementIndex++]);
}
