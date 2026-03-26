import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { sandboxes } from "@vela/db";
import type { SandboxStatus } from "@vela/types";

const MAX_PAYLOAD_BYTES = 256 * 1024;

export type SandboxHandle = {
  id: string;
  runId: string;
  status: SandboxStatus;
  snapshotPath?: string;
};

/**
 * Persist sandbox row and return handle (ephemeral compute is allowlisted in-process).
 */
export async function createSandboxForRun(
  db: DB,
  params: { runId: string },
): Promise<SandboxHandle> {
  const [row] = await db
    .insert(sandboxes)
    .values({ runId: params.runId, status: "ready" })
    .returning();

  if (!row) {
    throw new Error("failed to create sandbox row");
  }

  return {
    id: row.id,
    runId: params.runId,
    status: row.status as SandboxStatus,
  };
}

/** Allowlisted ops only — no arbitrary code execution. */
export async function executeSandboxOperation(
  _handle: SandboxHandle,
  op: { kind: "echo" | "add"; payload: unknown },
): Promise<{ output: unknown }> {
  const raw = JSON.stringify(op.payload ?? {});
  if (raw.length > MAX_PAYLOAD_BYTES) {
    throw new Error("sandbox payload too large");
  }

  if (op.kind === "echo") {
    return { output: op.payload };
  }

  if (op.kind === "add") {
    const p = op.payload as { a?: unknown; b?: unknown };
    const a = Number(p.a);
    const b = Number(p.b);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return { output: 0 };
    }
    return { output: a + b };
  }

  throw new Error(`unsupported sandbox op: ${String(op.kind)}`);
}

/**
 * Contract: sandbox is ephemeral; only Blob + DB are truth.
 * Uploads a JSON snapshot when `BLOB_READ_WRITE_TOKEN` is set.
 */
export async function snapshotSandboxState(params: {
  runId: string;
  label: string;
  payload: unknown;
}): Promise<{ url: string } | { skipped: true }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return { skipped: true };
  }

  const body = JSON.stringify({
    runId: params.runId,
    label: params.label,
    payload: params.payload,
    at: new Date().toISOString(),
  });

  const blob = await put(`vela/sandbox/${params.runId}.json`, body, {
    access: "public",
    token,
    addRandomSuffix: true,
  });

  return { url: blob.url };
}

export async function destroySandboxForRun(
  db: DB,
  sandboxId: string,
): Promise<void> {
  await db
    .update(sandboxes)
    .set({ status: "destroyed", destroyedAt: new Date() })
    .where(eq(sandboxes.id, sandboxId));
}
