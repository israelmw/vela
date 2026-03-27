import { and, desc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { DB } from "@vela/db";
import { secretBindings } from "@vela/db";

function now(): Date {
  return new Date();
}

/** Mark bindings past expiresAt as expired (best-effort housekeeping). */
export async function expireStaleSecretBindings(
  db: DB,
  t: Date = now(),
): Promise<number> {
  const result = await db
    .update(secretBindings)
    .set({ status: "expired" })
    .where(
      and(
        eq(secretBindings.status, "active"),
        isNotNull(secretBindings.expiresAt),
        lt(secretBindings.expiresAt, t),
      ),
    )
    .returning({ id: secretBindings.id });
  return result.length;
}

export async function findActiveSecretBinding(
  db: DB,
  params: {
    tenantId: string;
    agentId: string;
    provider: string;
  },
): Promise<(typeof secretBindings.$inferSelect) | null> {
  await expireStaleSecretBindings(db);

  const t = now();

  const viable = (
    row: typeof secretBindings.$inferSelect | undefined,
  ): (typeof secretBindings.$inferSelect) | null => {
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < t) return null;
    return row;
  };

  const [agentScoped] = await db
    .select()
    .from(secretBindings)
    .where(
      and(
        eq(secretBindings.tenantId, params.tenantId),
        eq(secretBindings.provider, params.provider),
        eq(secretBindings.status, "active"),
        eq(secretBindings.agentId, params.agentId),
      ),
    )
    .orderBy(desc(secretBindings.createdAt))
    .limit(1);

  const a = viable(agentScoped);
  if (a) return a;

  const [tenantScoped] = await db
    .select()
    .from(secretBindings)
    .where(
      and(
        eq(secretBindings.tenantId, params.tenantId),
        eq(secretBindings.provider, params.provider),
        eq(secretBindings.status, "active"),
        isNull(secretBindings.agentId),
      ),
    )
    .orderBy(desc(secretBindings.createdAt))
    .limit(1);

  return viable(tenantScoped);
}

export async function listSecretBindings(
  db: DB,
  params: { tenantId: string; agentId?: string },
) {
  const q = params.agentId
    ? and(
        eq(secretBindings.tenantId, params.tenantId),
        or(
          eq(secretBindings.agentId, params.agentId),
          isNull(secretBindings.agentId),
        ),
      )
    : eq(secretBindings.tenantId, params.tenantId);

  return db
    .select()
    .from(secretBindings)
    .where(q)
    .orderBy(desc(secretBindings.createdAt));
}

export async function createSecretBinding(
  db: DB,
  params: {
    tenantId: string;
    agentId: string | null;
    provider: string;
    scope: string;
    secretRef: string;
    expiresAt?: Date | null;
  },
): Promise<typeof secretBindings.$inferSelect> {
  const [row] = await db
    .insert(secretBindings)
    .values({
      tenantId: params.tenantId,
      agentId: params.agentId,
      provider: params.provider,
      scope: params.scope,
      secretRef: params.secretRef,
      status: "active",
      expiresAt: params.expiresAt ?? null,
    })
    .returning();
  return row!;
}

export async function revokeSecretBinding(
  db: DB,
  params: {
    id: string;
    tenantId: string;
    reason?: string;
  },
): Promise<{ ok: true } | { error: string }> {
  const [existing] = await db
    .select()
    .from(secretBindings)
    .where(
      and(
        eq(secretBindings.id, params.id),
        eq(secretBindings.tenantId, params.tenantId),
      ),
    )
    .limit(1);

  if (!existing) {
    return { error: "secret binding not found" };
  }

  const t = now();
  await db
    .update(secretBindings)
    .set({
      status: "revoked",
      revokedAt: t,
      revokedReason: params.reason ?? "revoked",
    })
    .where(eq(secretBindings.id, params.id));

  return { ok: true };
}

/** Revokes the current row and inserts a successor (OSS pointer rotation). */
export async function rotateSecretBinding(
  db: DB,
  params: {
    id: string;
    tenantId: string;
    newSecretRef: string;
    newExpiresAt?: Date | null;
  },
): Promise<
  { successor: typeof secretBindings.$inferSelect } | { error: string }
> {
  const [existing] = await db
    .select()
    .from(secretBindings)
    .where(
      and(
        eq(secretBindings.id, params.id),
        eq(secretBindings.tenantId, params.tenantId),
      ),
    )
    .limit(1);

  if (!existing || existing.status !== "active") {
    return { error: "active secret binding not found" };
  }

  const t = now();
  await db
    .update(secretBindings)
    .set({
      status: "revoked",
      revokedAt: t,
      revokedReason: "rotated",
      rotatedAt: t,
    })
    .where(eq(secretBindings.id, existing.id));

  const [succ] = await db
    .insert(secretBindings)
    .values({
      tenantId: existing.tenantId,
      agentId: existing.agentId,
      provider: existing.provider,
      scope: existing.scope,
      secretRef: params.newSecretRef,
      status: "active",
      expiresAt: params.newExpiresAt ?? null,
    })
    .returning();

  return { successor: succ! };
}
