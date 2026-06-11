import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "../env/server";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
