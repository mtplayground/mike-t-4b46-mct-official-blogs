"use client";

import { FormEvent, useState } from "react";

import { normalizeSubscriberEmail } from "@/lib/newsletter/validation";

type FormState = {
  tone: "idle" | "success" | "error";
  message: string;
};

function newsletterEndpoint() {
  const rustApiBaseUrl = process.env.NEXT_PUBLIC_RUST_API_BASE_URL;

  if (!rustApiBaseUrl) {
    return "/api/newsletter";
  }

  return new URL("/api/newsletter", rustApiBaseUrl).toString();
}

export function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    tone: "idle",
    message: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeSubscriberEmail(email);

    if (!normalizedEmail) {
      setFormState({
        tone: "error",
        message: "Enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    setFormState({ tone: "idle", message: "" });

    try {
      const response = await fetch(newsletterEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json()) as { message?: string };
      const message = payload.message ?? "Newsletter signup failed. Try again soon.";

      if (response.ok) {
        setEmail("");
        setFormState({
          tone: "success",
          message,
        });
        return;
      }

      setFormState({
        tone: "error",
        message,
      });
    } catch {
      setFormState({
        tone: "error",
        message: "Newsletter signup failed. Try again soon.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action="/newsletter" className="grid gap-3" method="post" noValidate onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-bold text-editorial-white" htmlFor="footer-email">
        Email address
        <input
          autoComplete="email"
          className="min-h-12 rounded-card border border-white/15 bg-white px-4 text-sm text-editorial-ink outline-none transition placeholder:text-editorial-muted focus:border-editorial-red focus:ring-2 focus:ring-editorial-red"
          id="footer-email"
          inputMode="email"
          maxLength={320}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <button
        className="editorial-button disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Joining..." : "Join newsletter"}
      </button>
      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${
          formState.tone === "success" ? "text-white" : "text-editorial-dark-card-muted"
        }`}
      >
        {formState.message}
      </p>
    </form>
  );
}
