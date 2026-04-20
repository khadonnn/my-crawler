import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

let prismaClient: PrismaClient | null = null;

function loadDatabaseUrlFromWorkspace() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const filePath = fileURLToPath(import.meta.url);
  const dirPath = path.dirname(filePath);

  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(dirPath, "..", ".env"),
    path.resolve(dirPath, "..", "..", "..", ".env"),
  ];

  for (const envPath of envCandidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    loadEnv({ path: envPath, override: false });

    if (process.env.DATABASE_URL) {
      break;
    }
  }
}

function createPrismaClient() {
  loadDatabaseUrlFromWorkspace();

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env at the workspace root or apps/web/.env.local.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    if (!prismaClient) {
      prismaClient = createPrismaClient();
    }

    return Reflect.get(prismaClient, property);
  },
});

export function getPrisma() {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }

  return prismaClient;
}
