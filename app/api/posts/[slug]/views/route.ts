import { PostStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type PostViewsRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function publishedPostWhere(slug: string) {
  return {
    publishedAt: {
      not: null,
    },
    slug,
    status: PostStatus.PUBLISHED,
  };
}

function postNotFoundResponse() {
  return NextResponse.json({ message: "Post not found." }, { status: 404 });
}

export async function GET(_request: Request, { params }: PostViewsRouteContext) {
  const { slug } = await params;

  try {
    const post = await prisma.post.findFirst({
      select: {
        views: true,
      },
      where: publishedPostWhere(slug),
    });

    if (!post) {
      return postNotFoundResponse();
    }

    return NextResponse.json({ views: post.views });
  } catch (error) {
    console.error("Failed to read post views:", error);

    return NextResponse.json({ message: "Could not read post views." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: PostViewsRouteContext) {
  const { slug } = await params;

  try {
    const post = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.post.updateMany({
        data: {
          views: {
            increment: 1,
          },
        },
        where: publishedPostWhere(slug),
      });

      if (updateResult.count === 0) {
        return null;
      }

      return tx.post.findFirst({
        select: {
          views: true,
        },
        where: publishedPostWhere(slug),
      });
    });

    if (!post) {
      return postNotFoundResponse();
    }

    return NextResponse.json({ views: post.views });
  } catch (error) {
    console.error("Failed to increment post views:", error);

    return NextResponse.json({ message: "Could not update post views." }, { status: 500 });
  }
}
