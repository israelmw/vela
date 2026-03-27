import type { DB } from "@vela/db";
import { artifacts } from "@vela/db";
import {
  createSandboxForRun,
  destroySandboxForRun,
  executeSandboxOperation,
  snapshotSandboxState,
} from "./lifecycle";

/**
 * Shared path: ephemeral sandbox row → allowlisted op → Blob snapshot → artifact row.
 * Used by workflow `artifact` steps and by the native agent tool loop (`vela.sandbox`).
 */
export async function executeSandboxStepForRun(
  db: DB,
  params: {
    runId: string;
    runStepId?: string | null;
    stepIndex?: number;
    op: { kind: "echo" | "add"; payload: unknown };
  },
): Promise<{ output: unknown }> {
  const handle = await createSandboxForRun(db, { runId: params.runId });
  try {
    const { output } = await executeSandboxOperation(handle, params.op);
    const label =
      params.stepIndex !== undefined
        ? `step-${params.stepIndex}`
        : `native-${Date.now()}`;
    const snap = await snapshotSandboxState({
      runId: params.runId,
      label,
      payload: output,
    });
    if ("url" in snap) {
      const serialized = JSON.stringify(output);
      const name =
        params.stepIndex !== undefined
          ? `sandbox-step-${params.stepIndex}.json`
          : `sandbox-native-${label}.json`;
      await db.insert(artifacts).values({
        runId: params.runId,
        runStepId: params.runStepId ?? null,
        name,
        type: "data",
        blobPath: snap.url,
        mimeType: "application/json",
        sizeBytes: Buffer.byteLength(serialized, "utf8"),
      });
    }
    return { output };
  } finally {
    await destroySandboxForRun(db, handle.id);
  }
}
