import { getPrisma } from "@scraping-platform/db";
import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrisma();
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizePlatform(platform: unknown): string {
  if (typeof platform !== "string" || !platform.trim()) {
    return "facebook";
  }

  return platform.trim().toLowerCase();
}

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Lax" | "None" | "Strict";
};

type PlaywrightStorageState = {
  cookies: PlaywrightCookie[];
  origins: Array<Record<string, unknown>>;
};

type ExtensionCookie = {
  domain?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite?: string;
  secure?: boolean;
  session?: boolean;
  storeId?: string;
  value: string;
};

function normalizeSameSite(
  value: unknown,
): "Lax" | "None" | "Strict" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === "no_restriction" || normalized === "none") {
    return "None";
  }

  if (normalized === "lax") {
    return "Lax";
  }

  if (normalized === "strict") {
    return "Strict";
  }

  return undefined;
}

function parseJsonArrayCookies(
  cookies: ExtensionCookie[],
): PlaywrightStorageState {
  return {
    cookies: cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? ".facebook.com",
      path: cookie.path ?? "/",
      expires:
        typeof cookie.expirationDate === "number" ? cookie.expirationDate : 0,
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure),
      sameSite: normalizeSameSite(cookie.sameSite),
    })),
    origins: [],
  };
}

function parseNetscapeCookiesToPlaywright(
  text: string,
): PlaywrightStorageState {
  const cookies: PlaywrightCookie[] = [];
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 7) {
      continue;
    }

    const [
      domain,
      _includeSubdomains,
      path,
      secure,
      expires,
      name,
      ...valueParts
    ] = parts;
    const value = valueParts.join("\t");
    const expiresNumber = Number(expires);

    cookies.push({
      name,
      value,
      domain,
      path,
      expires: Number.isFinite(expiresNumber) ? expiresNumber : 0,
      httpOnly: false,
      secure: secure === "TRUE",
    });
  }

  return {
    cookies,
    origins: [],
  };
}

function parseHeaderStringToPlaywright(text: string): PlaywrightStorageState {
  const cookies: PlaywrightCookie[] = [];

  for (const part of text.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!name) {
      continue;
    }

    cookies.push({
      name,
      value,
      domain: ".facebook.com",
      path: "/",
      expires: 0,
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
  }

  return {
    cookies,
    origins: [],
  };
}

function parseAnyCookieFormat(input: string): PlaywrightStorageState {
  const trimmed = input.trim();

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      return parseJsonArrayCookies(parsed as ExtensionCookie[]);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "cookies" in parsed &&
      Array.isArray((parsed as { cookies?: unknown }).cookies)
    ) {
      const storageState = parsed as {
        cookies: PlaywrightCookie[];
        origins?: Array<Record<string, unknown>>;
      };

      return {
        cookies: storageState.cookies,
        origins: Array.isArray(storageState.origins)
          ? storageState.origins
          : [],
      };
    }
  } catch {
    // Fall through to text-based parsers.
  }

  const looksLikeNetscape =
    trimmed.includes("# Netscape") ||
    trimmed.includes(".facebook.com") ||
    trimmed.includes("\t");

  if (looksLikeNetscape) {
    const parsed = parseNetscapeCookiesToPlaywright(trimmed);
    if (parsed.cookies.length > 0) {
      return parsed;
    }
  }

  if (trimmed.includes("=") && trimmed.includes(";")) {
    const parsed = parseHeaderStringToPlaywright(trimmed);
    if (parsed.cookies.length > 0) {
      return parsed;
    }
  }

  throw new Error("Invalid cookie format");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const platform = normalizePlatform(body?.platform);
    const sessionDataRaw = body?.sessionData;

    if (!name) {
      return NextResponse.json({ error: "Tên là bắt buộc" }, { status: 400 });
    }

    if (typeof sessionDataRaw !== "string" || !sessionDataRaw.trim()) {
      return NextResponse.json(
        { error: "Session cookie phải là chuỗi không được để trống" },
        { status: 400 },
      );
    }

    let sessionData: InputJsonValue;
    try {
      sessionData = parseAnyCookieFormat(sessionDataRaw) as InputJsonValue;
    } catch {
      const looksLikeNetscape =
        sessionDataRaw.includes("# Netscape") ||
        sessionDataRaw.includes(".facebook.com") ||
        sessionDataRaw.includes("\t");

      if (!looksLikeNetscape) {
        return NextResponse.json(
          { error: "Định dạng cookie không hợp lệ" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: "Định dạng cookie không hợp lệ" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    await prisma.account.create({
      data: {
        name,
        platform,
        sessionData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
