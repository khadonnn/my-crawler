import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export async function cleanupOldArtifacts(maxAgeMs: number): Promise<void> {
  let entries: Array<{ name: string; mtimeMs: number }> = [];

  try {
    const children = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });

    entries = await Promise.all(
      children.map(async (child) => {
        const childPath = path.join(STORAGE_ROOT, child.name);
        const stat = await fs.stat(childPath);
        return {
          name: child.name,
          mtimeMs: stat.mtimeMs,
        };
      }),
    );
  } catch {
    return;
  }

  const threshold = Date.now() - maxAgeMs;

  for (const entry of entries) {
    if (entry.mtimeMs < threshold) {
      await fs.rm(path.join(STORAGE_ROOT, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }
}
