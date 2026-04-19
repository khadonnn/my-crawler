import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

let prismaClient: PrismaClient | null = null;
let envInitialized = false;

function ensureDatabaseUrl() {
  if (envInitialized) {
    return;
  }

  envInitialized = true;
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

export function getPrisma() {
  ensureDatabaseUrl();

  if (prismaClient) {
    return prismaClient;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });

  prismaClient = new PrismaClient({ adapter });

  return prismaClient;
}
