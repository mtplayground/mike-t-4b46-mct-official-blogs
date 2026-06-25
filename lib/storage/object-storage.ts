import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getObjectStorageEnv, getSelfUrl, type ObjectStorageEnv } from "../env/server";

const POST_IMAGE_PREFIX = "post-images";
const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const SIGNED_READ_EXPIRES_SECONDS = 60 * 60;

const IMAGE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type SupportedImageContentType = keyof typeof IMAGE_CONTENT_TYPES;

export type ObjectStorageConfig = ObjectStorageEnv;

export type UploadPostImageInput = {
  body: ArrayBuffer | Uint8Array | Buffer;
  contentType: string;
  originalFilename?: string;
};

export type UploadedPostImage = {
  key: string;
  bucket: string;
  contentType: SupportedImageContentType;
  size: number;
};

let cachedConfig: ObjectStorageConfig | undefined;
let cachedClient: S3Client | undefined;

export function getObjectStorageConfig(): ObjectStorageConfig {
  cachedConfig ??= getObjectStorageEnv();
  return cachedConfig;
}

export function getObjectStorageClient() {
  const config = getObjectStorageConfig();

  cachedClient ??= new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

function toBuffer(body: UploadPostImageInput["body"]) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
}

function assertSupportedImageContentType(
  contentType: string,
): asserts contentType is SupportedImageContentType {
  if (!(contentType in IMAGE_CONTENT_TYPES)) {
    throw new Error("Post image uploads must be JPEG, PNG, WebP, or GIF.");
  }
}

function assertRelativeObjectKey(relativeKey: string) {
  const { prefix } = getObjectStorageConfig();

  if (!relativeKey || relativeKey.startsWith("/") || relativeKey.includes("..")) {
    throw new Error("Object keys must be relative paths without parent traversal.");
  }

  if (relativeKey.startsWith(prefix)) {
    throw new Error("Object keys must be stored without OBJECT_STORAGE_PREFIX.");
  }
}

export function toFullObjectKey(relativeKey: string) {
  assertRelativeObjectKey(relativeKey);
  return `${getObjectStorageConfig().prefix}${relativeKey}`;
}

function buildPostImageKey(contentType: SupportedImageContentType) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = IMAGE_CONTENT_TYPES[contentType];

  return `${POST_IMAGE_PREFIX}/${year}/${month}/${randomUUID()}.${extension}`;
}

function imageMetadata(originalFilename: string | undefined) {
  if (!originalFilename) {
    return undefined;
  }

  return {
    originalFilename: originalFilename.replace(/[^\x20-\x7E]/g, "").slice(0, 120),
  };
}

export async function uploadPostImage(input: UploadPostImageInput): Promise<UploadedPostImage> {
  assertSupportedImageContentType(input.contentType);

  const body = toBuffer(input.body);

  if (body.byteLength === 0) {
    throw new Error("Post image uploads cannot be empty.");
  }

  if (body.byteLength > MAX_POST_IMAGE_BYTES) {
    throw new Error("Post image uploads cannot exceed 10 MB.");
  }

  const key = buildPostImageKey(input.contentType);
  const fullKey = toFullObjectKey(key);
  const { bucket } = getObjectStorageConfig();

  await getObjectStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fullKey,
      Body: body,
      ContentType: input.contentType,
      ContentLength: body.byteLength,
      Metadata: imageMetadata(input.originalFilename),
    }),
  );

  return {
    key,
    bucket,
    contentType: input.contentType,
    size: body.byteLength,
  };
}

export async function getSignedPostImageUrl(
  relativeKey: string,
  expiresIn = SIGNED_READ_EXPIRES_SECONDS,
) {
  const { bucket } = getObjectStorageConfig();
  const fullKey = toFullObjectKey(relativeKey);

  return getSignedUrl(
    getObjectStorageClient(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: fullKey,
    }),
    { expiresIn },
  );
}

/**
 * Stable, never-expiring URL for displaying a stored image. Resolves to a fresh
 * presigned URL at request time via the `/api/image` proxy route, so it is safe
 * to embed in statically-prerendered HTML (a raw presigned URL would expire and
 * 403 for later visitors). Returns an absolute URL (usable in <img>, OG, JSON-LD).
 */
export async function getPostImageUrl(relativeKey: string): Promise<string> {
  assertRelativeObjectKey(relativeKey);
  const encodedKey = relativeKey.split("/").map(encodeURIComponent).join("/");
  return new URL(`/api/image/${encodedKey}`, getSelfUrl()).toString();
}

export async function deletePostImage(relativeKey: string) {
  const { bucket } = getObjectStorageConfig();
  const fullKey = toFullObjectKey(relativeKey);

  await getObjectStorageClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: fullKey,
    }),
  );
}
