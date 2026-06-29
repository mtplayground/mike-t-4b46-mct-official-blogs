export type MarkdownImageSigner = (key: string) => Promise<string>;

function defaultStorageImageUrl(relativeKey: string) {
  const encodedKey = relativeKey.split("/").map(encodeURIComponent).join("/");
  return new URL(`/api/image/${encodedKey}`, process.env.SELF_URL || "http://localhost:8080").toString();
}

export async function getSignedMarkdownBody(
  body: string,
  signer: MarkdownImageSigner = async (key) => defaultStorageImageUrl(key),
) {
  let output = "";
  let cursor = 0;

  while (true) {
    const markerStart = body.indexOf("](storage:", cursor);
    if (markerStart === -1) break;
    const keyStart = markerStart + "](storage:".length;
    const keyEnd = body.indexOf(")", keyStart);
    if (keyEnd === -1) break;
    const keyAndSuffix = body.slice(keyStart, keyEnd);
    const keyEndOffset = keyAndSuffix.search(/\s/u);
    const relativeKey = keyEndOffset === -1 ? keyAndSuffix : keyAndSuffix.slice(0, keyEndOffset);
    const suffix = keyEndOffset === -1 ? "" : keyAndSuffix.slice(keyEndOffset);

    output += body.slice(cursor, keyStart - "storage:".length);
    try {
      output += await signer(relativeKey);
      output += suffix;
    } catch (error) {
      console.error("Failed to sign Markdown storage image", error);
      output += `storage:${keyAndSuffix}`;
    }
    cursor = keyEnd;
  }

  output += body.slice(cursor);
  return output;
}
