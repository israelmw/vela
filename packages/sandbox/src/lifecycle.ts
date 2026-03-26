import { put } from "@vercel/blob";
import type { SandboxStatus } from "@vela/types";

export type SandboxHandle = {
  runId: string;
  status: SandboxStatus;
  snapshotPath?: string;
};

/**
 * Contract: sandbox is ephemeral; only Blob + DB are truth.
 * This stub uploads a small snapshot marker when `BLOB_READ_WRITE_TOKEN` exists.
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

export async function createSandboxStub(runId: string): Promise<SandboxHandle> {
  return { runId, status: "created" };
}

export async function destroySandboxStub(handle: SandboxHandle): Promise<void> {
  void handle;
}
