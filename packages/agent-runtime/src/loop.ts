import { generateText } from "ai";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import {
  approvals,
  agents,
  runSteps,
  runs,
  sessions,
} from "@vela/db";
import {
  appendMessage,
  appendRunEvent,
  completeRun,
  updateRunStatus,
} from "@vela/control-plane";
import {
  formatLongTermBlock,
  formatWorkingMemoryBlock,
  listWorkingMemory,
  loadShortTermTranscript,
  LONG_TERM_ENABLED,
  queryLongTermMemory,
  storeLongTermMemory,
  upsertWorkingMemory,
} from "@vela/memory";
import {
  createBuiltinWorkflowStepExecutor,
  drainWorkflowSteps,
  recordWorkflowPlan,
  type WorkflowStepSpec,
} from "@vela/workflow";
import { executeBuiltinTool } from "@vela/tool-router";
import { MAX_SUBAGENT_DEPTH } from "@vela/types";
import { runChildSubagentRun } from "./subagent";

function attachUserText(transcript: string): string {
  const lastUserLine = transcript
    .split("\n")
    .filter((l) => l.startsWith("user:"))
    .pop();
  return lastUserLine?.replace(/^user:\s*/, "").trim() ?? "";
}

function parseRiskyPayload(raw: string): {
  note: string;
  quorumRequired?: number;
  expiresInMinutes?: number;
} {
  const t = raw.trim();
  if (!t.startsWith("{")) {
    return { note: t };
  }
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const note = String(j.note ?? "");
    const out: { note: string; quorumRequired?: number; expiresInMinutes?: number } =
      { note };
    if (
      typeof j.quorumRequired === "number" &&
      j.quorumRequired >= 1
    ) {
      out.quorumRequired = Math.floor(j.quorumRequired);
    }
    if (
      typeof j.expiresInMinutes === "number" &&
      j.expiresInMinutes > 0
    ) {
      out.expiresInMinutes = Math.floor(j.expiresInMinutes);
    }
    return out;
  } catch {
    return { note: t };
  }
}

/**
 * Single-turn agent: reasoning step + optional vela.echo if user text mentions "echo:".
 * `workflow:[...]` runs a persisted multi-step plan (durable retries + approvals).
 */
export async function runAgentTurn(
  db: DB,
  runId: string,
  opts?: { requestId?: string },
): Promise<void> {
  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);

  if (!run) throw new Error(`run not found: ${runId}`);

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, run.sessionId))
    .limit(1);

  if (!session) throw new Error(`session not found for run ${runId}`);

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, run.agentId))
    .limit(1);

  if (!agent) throw new Error(`agent not found for run ${runId}`);

  await updateRunStatus(db, run.id, { status: "running" });

  await appendRunEvent(db, {
    runId: run.id,
    level: "info",
    eventType: "run.turn.start",
    message: "agent turn started",
    requestId: opts?.requestId ?? null,
    meta: { trigger: run.trigger },
  });

  let stepIndex = run.currentStep;
  const transcript = await loadShortTermTranscript(db, run.sessionId);
  const wm = await listWorkingMemory(db, run.sessionId);
  const wmBlock = formatWorkingMemoryBlock(wm);

  const baseUserTextEarly = attachUserText(transcript);
  const planGoalEarly =
    run.trigger === "subagent" &&
    run.plan &&
    typeof run.plan === "object" &&
    run.plan !== null &&
    "subagentGoal" in run.plan
      ? String(
          (run.plan as { subagentGoal?: unknown }).subagentGoal ?? "",
        ).trim()
      : "";
  const userTextEarly =
    planGoalEarly.length > 0 ? planGoalEarly : baseUserTextEarly;

  let ltBlock = "";
  if (LONG_TERM_ENABLED && userTextEarly.length > 3) {
    try {
      const hits = await queryLongTermMemory(db, {
        sessionId: run.sessionId,
        queryText: userTextEarly.slice(0, 2000),
      });
      ltBlock = formatLongTermBlock(hits);
    } catch {
      ltBlock = "";
    }
  }

  const contextForModelParts = [
    ltBlock,
    wmBlock,
    `Conversation:\n${transcript}`,
  ].filter(Boolean);
  const contextForModel = contextForModelParts.join("\n\n");

  const userText = userTextEarly;

  try {
    if (userText.toLowerCase().startsWith("workflow:")) {
      const raw = userText.slice("workflow:".length).trim();
      let steps: WorkflowStepSpec[];
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) throw new Error("expected JSON array");
        steps = parsed as WorkflowStepSpec[];
      } catch {
        await completeRun(db, run.id, null, "invalid workflow JSON");
        return;
      }

      await recordWorkflowPlan(db, { runId: run.id, steps });
      const executor = createBuiltinWorkflowStepExecutor({
        db,
        agentId: run.agentId,
        tenantId: session.tenantId,
        sessionId: run.sessionId,
        runId: run.id,
        spawnSubagent: ({ goal }) =>
          runChildSubagentRun(
            db,
            {
              id: run.id,
              sessionId: run.sessionId,
              agentId: run.agentId,
              subagentDepth: run.subagentDepth,
            },
            goal,
            (d, id) => runAgentTurn(d, id, opts),
          ),
      });
      const drain = await drainWorkflowSteps(db, {
        runId: run.id,
        agentId: run.agentId,
        tenantId: session.tenantId,
        sessionId: run.sessionId,
        executor,
        maxSteps: 40,
      });

      if (drain.halt === "approval") {
        return;
      }
      if (drain.halt === "fatal") {
        await completeRun(db, run.id, null, drain.message ?? "workflow failed");
        return;
      }

      const summary = `workflow ok (${drain.processed} steps executed)`;
      await appendMessage(db, {
        sessionId: run.sessionId,
        threadId: session.threadId,
        role: "assistant",
        content: { text: summary },
      });
      await db
        .update(runs)
        .set({ currentStep: stepIndex + drain.processed })
        .where(eq(runs.id, run.id));
      await completeRun(db, run.id, summary.slice(0, 500), null);
      return;
    }

    const [reasonStep] = await db
      .insert(runSteps)
      .values({
        runId: run.id,
        stepIndex: stepIndex++,
        type: "reasoning",
        status: "running",
      })
      .returning();

    if (userText.toLowerCase().startsWith("risky:")) {
      const parsed = parseRiskyPayload(userText.slice("risky:".length));
      const args = { note: parsed.note };
      const expiresAt =
        parsed.expiresInMinutes !== undefined
          ? new Date(Date.now() + parsed.expiresInMinutes * 60_000)
          : null;
      await db
        .update(runSteps)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(runSteps.id, reasonStep!.id));

      const [toolStep] = await db
        .insert(runSteps)
        .values({
          runId: run.id,
          stepIndex: stepIndex++,
          type: "tool_call",
          status: "pending",
          toolName: "vela.risky_change",
          toolInput: args,
        })
        .returning();

      await db.insert(approvals).values({
        runId: run.id,
        runStepId: toolStep!.id,
        type: "tool_call",
        payload: { toolId: "vela.risky_change", args },
        status: "pending",
        quorumRequired: parsed.quorumRequired ?? 1,
        expiresAt,
      });

      await db
        .update(runs)
        .set({
          currentStep: stepIndex,
          status: "awaiting_approval",
          requiresApproval: true,
        })
        .where(eq(runs.id, run.id));

      return;
    }

    if (userText.toLowerCase().startsWith("subagent:")) {
      const goal = userText.slice("subagent:".length).trim();
      if (!goal) {
        await db
          .update(runSteps)
          .set({ status: "failed", endedAt: new Date() })
          .where(eq(runSteps.id, reasonStep!.id));
        await completeRun(db, run.id, null, "subagent: goal required");
        return;
      }
      if (run.subagentDepth >= MAX_SUBAGENT_DEPTH) {
        await db
          .update(runSteps)
          .set({ status: "failed", endedAt: new Date() })
          .where(eq(runSteps.id, reasonStep!.id));
        await completeRun(db, run.id, null, "subagent max depth exceeded");
        return;
      }

      await db
        .update(runSteps)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(runSteps.id, reasonStep!.id));

      try {
        const out = await runChildSubagentRun(
          db,
          {
            id: run.id,
            sessionId: run.sessionId,
            agentId: run.agentId,
            subagentDepth: run.subagentDepth,
          },
          goal,
          (d, id) => runAgentTurn(d, id, opts),
        );
        await appendMessage(db, {
          sessionId: run.sessionId,
          threadId: session.threadId,
          role: "assistant",
          content: { text: out.summary },
        });

        await db
          .update(runs)
          .set({ currentStep: stepIndex })
          .where(eq(runs.id, run.id));

        await completeRun(db, run.id, out.summary.slice(0, 500), null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await completeRun(db, run.id, null, msg);
      }
      return;
    }

    if (userText.toLowerCase().startsWith("echo:")) {
      const payload = userText.slice(5).trim();
      const toolResult = await executeBuiltinTool(db, {
        agentId: run.agentId,
        tenantId: session.tenantId,
        sessionId: run.sessionId,
        toolId: "vela.echo",
        args: { text: payload },
      });

      if (!toolResult.ok) {
        throw new Error(toolResult.error);
      }

      await db
        .update(runSteps)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(runSteps.id, reasonStep!.id));

      const out = toolResult.output as { echoed?: unknown };
      const summary = JSON.stringify(out.echoed ?? out);

      await appendMessage(db, {
        sessionId: run.sessionId,
        threadId: session.threadId,
        role: "assistant",
        content: { text: summary },
      });

      await db
        .update(runs)
        .set({ currentStep: stepIndex })
        .where(eq(runs.id, run.id));

      await completeRun(db, run.id, summary.slice(0, 500), null);
      return;
    }

    const { text } = await generateText({
      model: agent.model,
      system: agent.systemPrompt,
      prompt: `${contextForModel}\n\nassistant:`,
    });

    await db
      .update(runSteps)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(runSteps.id, reasonStep!.id));

    await appendMessage(db, {
      sessionId: run.sessionId,
      threadId: session.threadId,
      role: "assistant",
      content: { text },
    });

    await db
      .update(runs)
      .set({ currentStep: stepIndex })
      .where(eq(runs.id, run.id));

    if (userText) {
      await upsertWorkingMemory(db, {
        sessionId: run.sessionId,
        key: "last_exchange",
        value: {
          user: userText.slice(0, 2000),
          assistant: text.slice(0, 2000),
          at: new Date().toISOString(),
        },
      });
    }

    if (LONG_TERM_ENABLED && text.trim()) {
      try {
        await storeLongTermMemory(db, {
          sessionId: run.sessionId,
          runId: run.id,
          content: `assistant: ${text.slice(0, 4000)}`,
          meta: { runId: run.id, source: "loop" },
        });
      } catch {
        /* optional memory */
      }
    }

    await appendRunEvent(db, {
      runId: run.id,
      level: "info",
      eventType: "run.turn.completed",
      message: "agent turn completed",
      requestId: opts?.requestId ?? null,
    });

    await completeRun(db, run.id, text.slice(0, 500), null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendRunEvent(db, {
      runId: run.id,
      level: "error",
      eventType: "run.turn.error",
      message: msg,
      requestId: opts?.requestId ?? null,
    }).catch(() => {});
    const [runningStep] = await db
      .select()
      .from(runSteps)
      .where(
        and(eq(runSteps.runId, run.id), eq(runSteps.status, "running")),
      )
      .orderBy(asc(runSteps.stepIndex))
      .limit(1);

    if (runningStep) {
      await db
        .update(runSteps)
        .set({ status: "failed", endedAt: new Date(), lastError: msg })
        .where(eq(runSteps.id, runningStep.id));
    }
    await completeRun(db, run.id, null, msg);
  }
}
