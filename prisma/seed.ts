import { prisma } from "../lib/db/prisma";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection verified. Seed data will be added with content models.");
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
