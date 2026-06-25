"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

const COVER_ASPECT_RATIO = 16 / 9;
const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;
const JPEG_QUALITY = 0.9;

type CropState = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

const initialCrop: CropState = {
  offsetX: 50,
  offsetY: 50,
  zoom: 100,
};

function cropBounds(image: HTMLImageElement, crop: CropState) {
  const zoom = crop.zoom / 100;
  let sourceWidth = image.naturalWidth / zoom;
  let sourceHeight = sourceWidth / COVER_ASPECT_RATIO;

  if (sourceHeight > image.naturalHeight / zoom) {
    sourceHeight = image.naturalHeight / zoom;
    sourceWidth = sourceHeight * COVER_ASPECT_RATIO;
  }

  sourceWidth = Math.min(sourceWidth, image.naturalWidth);
  sourceHeight = Math.min(sourceHeight, image.naturalHeight);

  const maxX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxY = Math.max(0, image.naturalHeight - sourceHeight);

  return {
    sourceHeight,
    sourceWidth,
    sourceX: maxX * (crop.offsetX / 100),
    sourceY: maxY * (crop.offsetY / 100),
  };
}

async function toCroppedCoverFile(file: File, image: HTMLImageElement, crop: CropState) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("The selected image could not be prepared for cropping.");
  }

  const { sourceHeight, sourceWidth, sourceX, sourceY } = cropBounds(image, crop);
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) {
    throw new Error("The selected image could not be exported after cropping.");
  }

  const basename = file.name.replace(/\.[^.]+$/, "") || "cover-image";
  return new File([blob], `${basename}-16x9-cover.jpg`, {
    lastModified: Date.now(),
    type: "image/jpeg",
  });
}

function assignFileToInput(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

export function CoverImageCropper() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const replayingSubmitRef = useRef(false);
  const [crop, setCrop] = useState<CropState>(initialCrop);
  const [isCropReady, setIsCropReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Select a cover image to crop it to 16:9 before upload.");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const input = fileInputRef.current;
    const form = input?.form;

    if (!form) {
      return undefined;
    }

    const handleSubmit = async (event: SubmitEvent) => {
      if (replayingSubmitRef.current) {
        replayingSubmitRef.current = false;
        return;
      }

      if (!selectedFile || isCropReady) {
        return;
      }

      event.preventDefault();
      const cropped = await applyCrop();

      if (cropped) {
        replayingSubmitRef.current = true;
        form.requestSubmit();
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  });

  async function applyCrop() {
    const input = fileInputRef.current;
    const image = imageRef.current;

    if (!input || !selectedFile || !image) {
      return null;
    }

    try {
      const croppedFile = await toCroppedCoverFile(selectedFile, image, crop);
      assignFileToInput(input, croppedFile);
      setIsCropReady(true);
      setStatus("16:9 cover crop ready. The cropped image will upload as the coverImage field.");
      return croppedFile;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The cover image could not be cropped.");
      return null;
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setCrop(initialCrop);
    setIsCropReady(false);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setStatus("Select a cover image to crop it to 16:9 before upload.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("Adjust the 16:9 crop, then apply it before saving.");
  }

  function updateCrop(field: keyof CropState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setIsCropReady(false);
      setCrop((current) => ({
        ...current,
        [field]: Number(event.currentTarget.value),
      }));
      setStatus("Crop adjusted. Apply the 16:9 crop before saving.");
    };
  }

  async function handleApplyClick(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    await applyCrop();
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-2">
        <span className="text-sm font-bold uppercase text-editorial-ink">Cover image</span>
        <input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="rounded-button border border-editorial-line bg-editorial-white px-4 py-3 text-sm"
          name="coverImage"
          onChange={handleFileChange}
          type="file"
        />
      </label>

      {previewUrl ? (
        <div className="grid gap-4 rounded-card border border-editorial-line bg-editorial-cream p-4">
          <div className="grid gap-2">
            <p className="text-sm font-bold uppercase text-editorial-ink">16:9 cover crop</p>
            <p className="text-sm leading-6 text-editorial-muted">
              Position the image in the 16:9 frame so it matches the public cover display.
            </p>
          </div>

          <div className="aspect-[16/9] overflow-hidden rounded-card border border-editorial-line bg-editorial-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL previews cannot use next/image. */}
            <img
              ref={imageRef}
              alt="Selected cover crop preview"
              className="h-full w-full object-cover"
              src={previewUrl}
              style={{
                objectPosition: `${crop.offsetX}% ${crop.offsetY}%`,
                transform: `scale(${crop.zoom / 100})`,
                transformOrigin: `${crop.offsetX}% ${crop.offsetY}%`,
              }}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-editorial-ink">
              Zoom
              <input
                max="300"
                min="100"
                onChange={updateCrop("zoom")}
                step="5"
                type="range"
                value={crop.zoom}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-editorial-ink">
              Horizontal position
              <input
                max="100"
                min="0"
                onChange={updateCrop("offsetX")}
                step="1"
                type="range"
                value={crop.offsetX}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-editorial-ink">
              Vertical position
              <input
                max="100"
                min="0"
                onChange={updateCrop("offsetY")}
                step="1"
                type="range"
                value={crop.offsetY}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="editorial-button w-fit" onClick={handleApplyClick} type="button">
              Apply 16:9 crop
            </button>
            <p aria-live="polite" className="text-sm leading-6 text-editorial-muted">
              {status}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6 text-editorial-muted">{status}</p>
      )}
    </div>
  );
}
