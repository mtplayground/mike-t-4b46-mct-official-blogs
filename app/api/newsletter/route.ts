import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getSubscriberSignupResult } from "@/lib/newsletter/subscribers";
import { normalizeSubscriberEmail } from "@/lib/newsletter/validation";

type NewsletterRequestBody = {
  email?: unknown;
};

async function readRequestBody(request: Request): Promise<NewsletterRequestBody | null> {
  try {
    const body = await request.json();

    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  const email = normalizeSubscriberEmail(body?.email);

  try {
    const signupResult = await getSubscriberSignupResult(email, prisma.subscriber);

    if (signupResult.status === "invalid") {
      return NextResponse.json({ message: signupResult.message }, { status: 400 });
    }

    if (signupResult.status === "duplicate") {
      return NextResponse.json({ message: signupResult.message }, { status: 409 });
    }

    await prisma.subscriber.create({
      data: {
        email: signupResult.email,
      },
    });

    return NextResponse.json({ message: signupResult.message }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "That email is already subscribed." }, { status: 409 });
    }

    console.error("Newsletter signup failed:", error);

    return NextResponse.json(
      { message: "Newsletter signup failed. Try again soon." },
      { status: 500 },
    );
  }
}
