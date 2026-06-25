"use client";

import { useEffect, useRef, useState } from "react";

const MEGABYTE = 1024 * 1024;
const MAX_MULTIPART_UPLOAD_BYTES = 25 * MEGABYTE;
const IMAGE_INPUT_NAMES = ["coverImage", "authorAvatar", "inlineImage"];

function formatMegabytes(bytes: number) {
  return (bytes / MEGABYTE).toFixed(1).replace(/\.0$/u, "");
}

function selectedUploadBytes(form: HTMLFormElement) {
  return IMAGE_INPUT_NAMES.reduce((total, name) => {
    const input = form.elements.namedItem(name);

    if (!(input instanceof HTMLInputElement) || input.type !== "file") {
      return total;
    }

    return (
      total + Array.from(input.files ?? []).reduce((inputTotal, file) => inputTotal + file.size, 0)
    );
  }, 0);
}

export function PostUploadSizeWarning() {
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const form = containerRef.current?.closest("form");

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const formElement = form;

    function handleSubmit(event: SubmitEvent) {
      const totalBytes = selectedUploadBytes(formElement);

      if (totalBytes <= MAX_MULTIPART_UPLOAD_BYTES) {
        setMessage(null);
        return;
      }

      event.preventDefault();
      setMessage(
        `Selected images total ${formatMegabytes(totalBytes)} MB. Keep combined image uploads under 25 MB and try again.`,
      );
      requestAnimationFrame(() => messageRef.current?.focus());
    }

    formElement.addEventListener("submit", handleSubmit);

    return () => formElement.removeEventListener("submit", handleSubmit);
  }, []);

  return (
    <div ref={containerRef}>
      {message ? (
        <p
          className="rounded-card border border-editorial-red bg-editorial-white px-5 py-4 text-sm font-bold text-editorial-red"
          ref={messageRef}
          role="alert"
          tabIndex={-1}
        >
          {message}
        </p>
      ) : null}
      <p className="text-sm leading-6 text-editorial-muted">
        Keep combined image uploads under 25 MB per post submission.
      </p>
    </div>
  );
}
