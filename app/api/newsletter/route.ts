import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
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

  if (!email) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const existingSubscriber = await prisma.subscriber.findUnique({
      select: {
        id: true,
      },
      where: {
        email,
      },
    });

    if (existingSubscriber) {
      return NextResponse.json({ message: "That email is already subscribed." }, { status: 409 });
    }

    await prisma.subscriber.create({
      data: {
        email,
      },
    });

    return NextResponse.json({ message: "You are on the list." }, { status: 201 });
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
