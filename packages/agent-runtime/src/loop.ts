import { generateText } from "ai";
import { asc, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import {
  approvals,
  agents,
  messages,
  runSteps,
  runs,
  sessions,
} from "@vela/db";
import {
  appendMessage,
  completeRun,
  updateRunStatus,
} from "@vela/control-plane";
import { executeBuiltinTool } from "@vela/tool-router";

/** Load recent transcript as plain text for the model. */
async function buildPrompt(db: DB, sessionId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  return rows
    .map((m) => {
      const c = m.content as { text?: string } | string;
      const body = typeof c === "string" ? c : (c.text ?? JSON.stringify(c));
      return `${m.role}: ${body}`;
    })
    .join("\n");
}

/**
 * Single-turn agent: reasoning step + optional vela.echo if user text mentions "echo:".
 * Full multi-step tool loop expands in later iterations.
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
  const transcript = await buildPrompt(db, run.sessionId);

  const [reasonStep] = await db
    .insert(runSteps)
    .values({
      runId: run.id,
      stepIndex: stepIndex++,
      type: "reasoning",
      status: "running",
    })
    .returning();

  try {
    const lastUserLine = transcript.split("\n").filter((l) => l.startsWith("user:")).pop();
    const userText =
      lastUserLine?.replace(/^user:\s*/, "").trim() ?? "";

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
      prompt: `Conversation:\n${transcript}\n\nassistant:`,
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

    await completeRun(db, run.id, text.slice(0, 500), null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .update(runSteps)
      .set({ status: "failed", endedAt: new Date() })
      .where(eq(runSteps.id, reasonStep!.id));
    await completeRun(db, run.id, null, msg);
  }
}
