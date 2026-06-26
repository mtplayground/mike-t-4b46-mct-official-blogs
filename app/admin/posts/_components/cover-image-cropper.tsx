"use client";

import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

const COVER_ASPECT_RATIO = 16 / 9;
const SQUARE_ASPECT_RATIO = 1;
const COVER_OUTPUT_WIDTH = 1600;
const COVER_OUTPUT_HEIGHT = 900;
const SQUARE_OUTPUT_SIZE = 1200;
const JPEG_QUALITY = 0.9;
const SQUARE_INPUT_NAME = "squareCoverImage";

type CropState = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

type CropOutputConfig = {
  aspectRatio: number;
  filenameSuffix: string;
  height: number;
  width: number;
};

const initialCrop: CropState = {
  offsetX: 50,
  offsetY: 50,
  zoom: 100,
};

const coverOutputConfig: CropOutputConfig = {
  aspectRatio: COVER_ASPECT_RATIO,
  filenameSuffix: "16x9-cover",
  height: COVER_OUTPUT_HEIGHT,
  width: COVER_OUTPUT_WIDTH,
};

const squareOutputConfig: CropOutputConfig = {
  aspectRatio: SQUARE_ASPECT_RATIO,
  filenameSuffix: "1x1-square-cover",
  height: SQUARE_OUTPUT_SIZE,
  width: SQUARE_OUTPUT_SIZE,
};

function cropBounds(image: HTMLImageElement, crop: CropState, aspectRatio: number) {
  const zoom = crop.zoom / 100;
  let sourceWidth = image.naturalWidth / zoom;
  let sourceHeight = sourceWidth / aspectRatio;

  if (sourceHeight > image.naturalHeight / zoom) {
    sourceHeight = image.naturalHeight / zoom;
    sourceWidth = sourceHeight * aspectRatio;
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

async function toCroppedFile(
  file: File,
  image: HTMLImageElement,
  crop: CropState,
  output: CropOutputConfig,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("The selected image could not be prepared for cropping.");
  }

  const { sourceHeight, sourceWidth, sourceX, sourceY } = cropBounds(
    image,
    crop,
    output.aspectRatio,
  );

  canvas.width = output.width;
  canvas.height = output.height;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    output.width,
    output.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) {
    throw new Error("The selected image could not be exported after cropping.");
  }

  const basename = file.name.replace(/\.[^.]+$/, "") || "cover-image";
  return new File([blob], `${basename}-${output.filenameSuffix}.jpg`, {
    lastModified: Date.now(),
    type: "image/jpeg",
  });
}

function assignFileToInput(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function clearFileInput(input: HTMLInputElement | null) {
  if (input) {
    input.value = "";
  }
}

function findSquareInput(form: HTMLFormElement | null) {
  const squareInput = form?.elements.namedItem(SQUARE_INPUT_NAME);

  return squareInput instanceof HTMLInputElement ? squareInput : null;
}

function cropPreviewStyle(crop: CropState) {
  return {
    objectPosition: `${crop.offsetX}% ${crop.offsetY}%`,
    transform: `scale(${crop.zoom / 100})`,
    transformOrigin: `${crop.offsetX}% ${crop.offsetY}%`,
  };
}

export function CoverImageCropper() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const replayingSubmitRef = useRef(false);
  const [coverCrop, setCoverCrop] = useState<CropState>(initialCrop);
  const [squareCrop, setSquareCrop] = useState<CropState>(initialCrop);
  const [areCropsReady, setAreCropsReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState(
    "Select a cover image to prepare both 16:9 and square crops before upload.",
  );

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

      if (!selectedFile || areCropsReady) {
        return;
      }

      event.preventDefault();
      const cropped = await applyCrops();

      if (cropped) {
        replayingSubmitRef.current = true;
        form.requestSubmit();
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  });

  async function applyCrops() {
    const coverInput = fileInputRef.current;
    const image = imageRef.current;
    const squareInput = findSquareInput(coverInput?.form ?? null);

    if (!coverInput || !squareInput || !selectedFile || !image) {
      setStatus("The crop tool could not find both upload fields. Refresh and try again.");
      return null;
    }

    try {
      const [coverFile, squareFile] = await Promise.all([
        toCroppedFile(selectedFile, image, coverCrop, coverOutputConfig),
        toCroppedFile(selectedFile, image, squareCrop, squareOutputConfig),
      ]);
      assignFileToInput(coverInput, coverFile);
      assignFileToInput(squareInput, squareFile);
      setAreCropsReady(true);
      setStatus("Both 16:9 and square cover crops are ready and will upload when saved.");
      return { coverFile, squareFile };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The cover image could not be cropped.");
      return null;
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    const squareInput = findSquareInput(event.currentTarget.form);
    setCoverCrop(initialCrop);
    setSquareCrop(initialCrop);
    setAreCropsReady(false);
    clearFileInput(squareInput);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setStatus("Select a cover image to prepare both 16:9 and square crops before upload.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("Adjust both crops, then apply them before saving.");
  }

  function updateCoverCrop(field: keyof CropState) {
    return updateCrop(field, setCoverCrop, "Cover crop adjusted. Apply both crops before saving.");
  }

  function updateSquareCrop(field: keyof CropState) {
    return updateCrop(
      field,
      setSquareCrop,
      "Square crop adjusted. Apply both crops before saving.",
    );
  }

  function updateCrop(
    field: keyof CropState,
    setCrop: Dispatch<SetStateAction<CropState>>,
    nextStatus: string,
  ) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setAreCropsReady(false);
      setCrop((current) => ({
        ...current,
        [field]: Number(event.currentTarget.value),
      }));
      setStatus(nextStatus);
    };
  }

  async function handleApplyClick(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    await applyCrops();
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
        <div className="grid gap-5 rounded-card border border-editorial-line bg-editorial-cream p-4">
          <div className="grid gap-2">
            <p className="text-sm font-bold uppercase text-editorial-ink">Cover crop tool</p>
            <p className="text-sm leading-6 text-editorial-muted">
              Position the source image for both public display sizes. The form will upload a 16:9
              cover and a separate 1:1 square cover image.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,420px)]">
            <section className="grid gap-4" aria-labelledby="cover-crop-heading">
              <div className="grid gap-2">
                <h3
                  className="text-sm font-bold uppercase text-editorial-ink"
                  id="cover-crop-heading"
                >
                  16:9 cover crop
                </h3>
                <p className="text-sm leading-6 text-editorial-muted">
                  Match the wide public cover display.
                </p>
              </div>

              <div className="aspect-[16/9] overflow-hidden rounded-card border border-editorial-line bg-editorial-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL previews cannot use next/image. */}
                <img
                  ref={imageRef}
                  alt="Selected 16:9 cover crop preview"
                  className="h-full w-full object-cover"
                  src={previewUrl}
                  style={cropPreviewStyle(coverCrop)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Zoom
                  <input
                    max="300"
                    min="100"
                    onChange={updateCoverCrop("zoom")}
                    step="5"
                    type="range"
                    value={coverCrop.zoom}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Horizontal position
                  <input
                    max="100"
                    min="0"
                    onChange={updateCoverCrop("offsetX")}
                    step="1"
                    type="range"
                    value={coverCrop.offsetX}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Vertical position
                  <input
                    max="100"
                    min="0"
                    onChange={updateCoverCrop("offsetY")}
                    step="1"
                    type="range"
                    value={coverCrop.offsetY}
                  />
                </label>
              </div>
            </section>

            <section className="grid gap-4" aria-labelledby="square-crop-heading">
              <div className="grid gap-2">
                <h3
                  className="text-sm font-bold uppercase text-editorial-ink"
                  id="square-crop-heading"
                >
                  Square 1:1 crop
                </h3>
                <p className="text-sm leading-6 text-editorial-muted">
                  Adjust the square image that will be uploaded as a separate storage object.
                </p>
              </div>

              <div className="aspect-square overflow-hidden rounded-card border border-editorial-line bg-editorial-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL previews cannot use next/image. */}
                <img
                  alt="Selected square cover crop preview"
                  className="h-full w-full object-cover"
                  src={previewUrl}
                  style={cropPreviewStyle(squareCrop)}
                />
              </div>

              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Zoom
                  <input
                    max="300"
                    min="100"
                    onChange={updateSquareCrop("zoom")}
                    step="5"
                    type="range"
                    value={squareCrop.zoom}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Horizontal position
                  <input
                    max="100"
                    min="0"
                    onChange={updateSquareCrop("offsetX")}
                    step="1"
                    type="range"
                    value={squareCrop.offsetX}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-editorial-ink">
                  Vertical position
                  <input
                    max="100"
                    min="0"
                    onChange={updateSquareCrop("offsetY")}
                    step="1"
                    type="range"
                    value={squareCrop.offsetY}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="editorial-button w-fit" onClick={handleApplyClick} type="button">
              Apply cover crops
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
