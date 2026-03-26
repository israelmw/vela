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
  completeRun,
  updateRunStatus,
} from "@vela/control-plane";
import {
  formatWorkingMemoryBlock,
  listWorkingMemory,
  loadShortTermTranscript,
  upsertWorkingMemory,
} from "@vela/memory";
import {
  createBuiltinWorkflowStepExecutor,
  drainWorkflowSteps,
  recordWorkflowPlan,
  type WorkflowStepSpec,
} from "@vela/workflow";
import { executeBuiltinTool } from "@vela/tool-router";

function attachUserText(transcript: string): string {
  const lastUserLine = transcript
    .split("\n")
    .filter((l) => l.startsWith("user:"))
    .pop();
  return lastUserLine?.replace(/^user:\s*/, "").trim() ?? "";
}

/**
 * Single-turn agent: reasoning step + optional vela.echo if user text mentions "echo:".
 * `workflow:[...]` runs a persisted multi-step plan (durable retries + approvals).
 */
export async function runAgentTurn(db: DB, runId: string): Promise<void> {
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

  let stepIndex = run.currentStep;
  const transcript = await loadShortTermTranscript(db, run.sessionId);
  const wm = await listWorkingMemory(db, run.sessionId);
  const wmBlock = formatWorkingMemoryBlock(wm);
  const contextForModel = wmBlock
    ? `${wmBlock}\n\nConversation:\n${transcript}`
    : `Conversation:\n${transcript}`;

  const userText = attachUserText(transcript);

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
      const args = { note: userText.slice(5).trim() };
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

    await completeRun(db, run.id, text.slice(0, 500), null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
