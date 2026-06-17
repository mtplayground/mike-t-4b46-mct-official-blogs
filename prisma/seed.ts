import { CategorySlug, PostStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

const categories = [
  {
    slug: CategorySlug.THOUGHTS,
    name: "Thoughts",
    description:
      "Perspective on AI engineering, product craft, and how teams can use automation well.",
  },
  {
    slug: CategorySlug.PRODUCT_PROGRESS,
    name: "Product Progress",
    description: "Build notes and product updates from the myClawTeam engineering roadmap.",
  },
  {
    slug: CategorySlug.ANNOUNCEMENTS,
    name: "Announcements",
    description: "Launch notes, company updates, and important news from myClawTeam.",
  },
] as const;

const samplePosts = [
  {
    title: "Designing an AI Engineering Team That Feels Practical",
    slug: "designing-an-ai-engineering-team-that-feels-practical",
    excerpt:
      "A short look at how myClawTeam approaches AI engineering as focused, reviewable work rather than one-off automation.",
    body: [
      "AI engineering works best when it is treated like engineering, not magic. The useful work is scoped, reviewed, tested, and improved over time.",
      "myClawTeam is built around that idea: small steps, clear ownership, and practical automation that helps teams ship without losing the thread of what changed.",
      "This blog will share the product thinking, technical decisions, and operational patterns behind that approach.",
    ].join("\n\n"),
    categorySlug: CategorySlug.THOUGHTS,
    isFeatured: false,
    authorName: "myClawTeam Editorial Team",
    authorIntro:
      "Notes from the myClawTeam team on practical AI engineering, product craft, and dependable delivery habits.",
    authorAvatarKey: null,
    publishedAt: new Date("2026-05-20T14:00:00.000Z"),
  },
  {
    title: "Progress Notes from the Official Blog Foundation",
    slug: "progress-notes-from-the-official-blog-foundation",
    excerpt:
      "The first foundation pieces are in place: a typed Next.js app, editorial styling tokens, PostgreSQL, and object storage helpers.",
    body: [
      "The official blog now has its core application structure in place. The foundation includes the Next.js App Router, TypeScript, Tailwind editorial tokens, Prisma, PostgreSQL migrations, and an S3-compatible storage client.",
      "Those pieces are intentionally modest. They make the next layers easier to review: public reading pages, admin workflows, metadata, tests, and deployment hardening.",
      "The goal is a publishing surface that is simple to operate and easy to evolve as myClawTeam shares more product progress.",
    ].join("\n\n"),
    categorySlug: CategorySlug.PRODUCT_PROGRESS,
    isFeatured: true,
    authorName: "myClawTeam Product Team",
    authorIntro:
      "Build updates from the myClawTeam product team, focused on transparent progress and maintainable software systems.",
    authorAvatarKey: null,
    publishedAt: new Date("2026-05-27T14:00:00.000Z"),
  },
  {
    title: "Welcome to the myClawTeam Official Blog",
    slug: "welcome-to-the-myclawteam-official-blog",
    excerpt:
      "The official blog is where myClawTeam will publish announcements, product updates, and practical notes from the engineering team.",
    body: [
      "Welcome to the myClawTeam official blog. This space will collect announcements, product updates, and practical engineering notes.",
      "The editorial direction is simple: clear writing, useful context, and enough technical detail for readers to understand what changed and why it matters.",
      "More posts will arrive as the publishing workflow comes online.",
    ].join("\n\n"),
    categorySlug: CategorySlug.ANNOUNCEMENTS,
    isFeatured: false,
    authorName: "myClawTeam Communications",
    authorIntro:
      "Official announcements and launch notes from myClawTeam, written for readers tracking product and platform milestones.",
    authorAvatarKey: null,
    publishedAt: new Date("2026-06-03T14:00:00.000Z"),
  },
] as const;

async function seedCategories() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {
        name: category.name,
        description: category.description,
      },
    });
  }
}

async function seedSamplePosts() {
  for (const post of samplePosts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        isFeatured: post.isFeatured,
        authorName: post.authorName,
        authorIntro: post.authorIntro,
        authorAvatarKey: post.authorAvatarKey,
        status: PostStatus.PUBLISHED,
        publishedAt: post.publishedAt,
        category: {
          connect: { slug: post.categorySlug },
        },
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        isFeatured: post.isFeatured,
        authorName: post.authorName,
        authorIntro: post.authorIntro,
        authorAvatarKey: post.authorAvatarKey,
        status: PostStatus.PUBLISHED,
        publishedAt: post.publishedAt,
        category: {
          connect: { slug: post.categorySlug },
        },
      },
    });
  }
}

async function main() {
  await seedCategories();
  await seedSamplePosts();

  const [categoryCount, publishedPostCount] = await Promise.all([
    prisma.category.count(),
    prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
  ]);

  console.log(`Seeded ${categoryCount} categories and ${publishedPostCount} published posts.`);
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
