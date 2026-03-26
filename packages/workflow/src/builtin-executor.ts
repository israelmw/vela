import type { DB } from "@vela/db";
import { artifacts, runSteps } from "@vela/db";
import type { InferSelectModel } from "drizzle-orm";
import {
  createSandboxForRun,
  destroySandboxForRun,
  executeSandboxOperation,
  snapshotSandboxState,
} from "@vela/sandbox";
import { executeBuiltinTool } from "@vela/tool-router";
import type { StepDriverResult } from "./executor";

export type RunStepRow = InferSelectModel<typeof runSteps>;

export type BuiltinExecutorContext = {
  db: DB;
  agentId: string;
  tenantId: string;
  sessionId: string;
  runId: string;
};

export function createBuiltinWorkflowStepExecutor(
  ctx: BuiltinExecutorContext,
): (step: RunStepRow) => Promise<StepDriverResult> {
  return async (step: RunStepRow) => {
    switch (step.type) {
      case "reasoning":
        return {
          kind: "success",
          output: { label: "reasoning", stepIndex: step.stepIndex },
        };

      case "approval_gate":
        return {
          kind: "fail",
          error: "approval_gate requires external resolution",
        };

      case "artifact": {
        const handle = await createSandboxForRun(ctx.db, { runId: ctx.runId });
        try {
          const op = (step.toolInput ?? {}) as {
            kind?: string;
            payload?: unknown;
          };
          const out = await executeSandboxOperation(handle, {
            kind: (op.kind as "echo" | "add") ?? "echo",
            payload: op.payload ?? {},
          });
          const snap = await snapshotSandboxState({
            runId: ctx.runId,
            label: `step-${step.stepIndex}`,
            payload: out,
          });
          if ("url" in snap) {
            const serialized = JSON.stringify(out);
            await ctx.db.insert(artifacts).values({
              runId: ctx.runId,
              runStepId: step.id,
              name: `sandbox-step-${step.stepIndex}.json`,
              type: "data",
              blobPath: snap.url,
              mimeType: "application/json",
              sizeBytes: Buffer.byteLength(serialized, "utf8"),
            });
          }
        } finally {
          await destroySandboxForRun(ctx.db, handle.id);
        }
        return { kind: "success", output: { sandbox: "snapshot" } };
      }

      case "tool_call": {
        const toolId = step.toolName;
        if (!toolId) {
          return { kind: "fail", error: "tool_call missing toolName" };
        }
        const result = await executeBuiltinTool(ctx.db, {
          agentId: ctx.agentId,
          tenantId: ctx.tenantId,
          sessionId: ctx.sessionId,
          toolId,
          args: step.toolInput ?? {},
        });
        if (!result.ok) {
          if (result.code === "requires_approval") {
            return {
              kind: "approval",
              toolId,
              args: step.toolInput ?? {},
            };
          }
          if (result.code === "denied" || result.code === "unknown_tool") {
            return { kind: "fail", error: result.error };
          }
          return { kind: "retry", error: result.error };
        }
        return { kind: "success", output: result.output };
      }

      case "subagent":
        return { kind: "fail", error: "subagent not implemented" };

      default:
        return { kind: "fail", error: `unknown step type: ${step.type}` };
    }
  };
}
