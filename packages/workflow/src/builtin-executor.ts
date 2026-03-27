import type { DB } from "@vela/db";
import { runSteps } from "@vela/db";
import type { InferSelectModel } from "drizzle-orm";
import { executeSandboxStepForRun } from "@vela/sandbox";
import { executeBuiltinTool } from "@vela/tool-router";
import { expiresAtFromMinutes, stripApprovalToolMeta } from "./approval-meta";
import type { StepDriverResult } from "./executor";

export type RunStepRow = InferSelectModel<typeof runSteps>;

export type BuiltinExecutorContext = {
  db: DB;
  agentId: string;
  tenantId: string;
  sessionId: string;
  runId: string;
  /** Dynamic subagent spawn (workflow `subagent` steps). */
  spawnSubagent?: (input: { goal: string }) => Promise<{
    childRunId: string;
    summary: string;
  }>;
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
        const op = (step.toolInput ?? {}) as {
          kind?: string;
          payload?: unknown;
        };
        await executeSandboxStepForRun(ctx.db, {
          runId: ctx.runId,
          runStepId: step.id,
          stepIndex: step.stepIndex,
          op: {
            kind: (op.kind as "echo" | "add") ?? "echo",
            payload: op.payload ?? {},
          },
        });
        return { kind: "success", output: { sandbox: "snapshot" } };
      }

      case "tool_call": {
        const toolId = step.toolName;
        if (!toolId) {
          return { kind: "fail", error: "tool_call missing toolName" };
        }
        const {
          cleanArgs,
          quorumRequired,
          expiresInMinutes,
          approvalType,
        } = stripApprovalToolMeta(step.toolInput ?? {});
        const result = await executeBuiltinTool(ctx.db, {
          agentId: ctx.agentId,
          tenantId: ctx.tenantId,
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          toolId,
          args: cleanArgs,
        });
        if (!result.ok) {
          if (result.code === "requires_approval") {
            const exp = expiresAtFromMinutes(expiresInMinutes);
            return {
              kind: "approval",
              toolId,
              args: cleanArgs,
              ...(approvalType !== undefined ? { approvalType } : {}),
              ...(quorumRequired !== undefined ? { quorumRequired } : {}),
              ...(exp !== null ? { expiresAt: exp } : {}),
            };
          }
          if (result.code === "denied" || result.code === "unknown_tool") {
            return { kind: "fail", error: result.error };
          }
          return { kind: "retry", error: result.error };
        }
        return { kind: "success", output: result.output };
      }

      case "subagent": {
        const input = (step.toolInput ?? {}) as { goal?: string };
        const goal = typeof input.goal === "string" ? input.goal.trim() : "";
        if (!goal) {
          return { kind: "fail", error: "subagent step missing goal" };
        }
        if (!ctx.spawnSubagent) {
          return {
            kind: "fail",
            error: "subagent spawn not configured for this run",
          };
        }
        try {
          const out = await ctx.spawnSubagent({ goal });
          return {
            kind: "success",
            output: {
              subagent: true,
              childRunId: out.childRunId,
              summary: out.summary,
            },
          };
        } catch (e) {
          return {
            kind: "fail",
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      default:
        return { kind: "fail", error: `unknown step type: ${step.type}` };
    }
  };
}
