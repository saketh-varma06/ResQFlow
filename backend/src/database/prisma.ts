import { PrismaClient } from "@prisma/client";
// Single shared Prisma client. In tests, DATABASE_URL is swapped to the test database before import.
export const prisma = new PrismaClient();
export async function disconnectPrisma() { await prisma.$disconnect(); }
