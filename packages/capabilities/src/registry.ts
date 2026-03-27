import type { DB } from "@vela/db";
import {
  capabilityInstalls,
  capabilityPackages,
  skillsRegistry,
} from "@vela/db";
import { and, eq, inArray } from "drizzle-orm";
import { parseCapabilityManifest } from "./manifest";

export async function upsertCapabilityPackage(
  db: DB,
  params: {
    ref: string;
    name: string;
    version: string;
    manifest: unknown;
    source?: string | null;
  },
): Promise<void> {
  const manifestObj = params.manifest as object;
  await db
    .insert(capabilityPackages)
    .values({
      ref: params.ref,
      name: params.name,
      version: params.version,
      manifest: manifestObj,
      source: params.source ?? null,
    })
    .onConflictDoUpdate({
      target: capabilityPackages.ref,
      set: {
        name: params.name,
        version: params.version,
        manifest: manifestObj,
        source: params.source ?? null,
      },
    });
}

export async function applyManifestSkills(db: DB, manifest: unknown) {
  const parsed = parseCapabilityManifest(manifest);
  for (const skill of parsed.skills) {
    await db
      .insert(skillsRegistry)
      .values({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        instructions: skill.instructions,
        files: skill.files ?? [],
        requiredTools: skill.requiredTools ?? [],
        requiredMcp: skill.requiredMcp ?? [],
      })
      .onConflictDoUpdate({
        target: skillsRegistry.id,
        set: {
          name: skill.name,
          description: skill.description,
          version: skill.version,
          instructions: skill.instructions,
          files: skill.files ?? [],
          requiredTools: skill.requiredTools ?? [],
          requiredMcp: skill.requiredMcp ?? [],
        },
      });
  }
}

export async function installCapabilityForAgent(
  db: DB,
  params: {
    tenantId: string;
    agentId: string;
    packageRef: string;
  },
): Promise<void> {
  const [pkg] = await db
    .select()
    .from(capabilityPackages)
    .where(eq(capabilityPackages.ref, params.packageRef))
    .limit(1);

  if (!pkg) {
    throw new Error(`capability package not found: ${params.packageRef}`);
  }

  await applyManifestSkills(db, pkg.manifest);

  const [existing] = await db
    .select()
    .from(capabilityInstalls)
    .where(
      and(
        eq(capabilityInstalls.tenantId, params.tenantId),
        eq(capabilityInstalls.agentId, params.agentId),
        eq(capabilityInstalls.packageRef, params.packageRef),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(capabilityInstalls)
      .set({ enabled: true })
      .where(eq(capabilityInstalls.id, existing.id));
  } else {
    await db.insert(capabilityInstalls).values({
      tenantId: params.tenantId,
      agentId: params.agentId,
      packageRef: params.packageRef,
      enabled: true,
    });
  }
}

export async function disableCapabilityForAgent(
  db: DB,
  params: {
    tenantId: string;
    agentId: string;
    packageRef: string;
  },
): Promise<void> {
  await db
    .update(capabilityInstalls)
    .set({ enabled: false })
    .where(
      and(
        eq(capabilityInstalls.tenantId, params.tenantId),
        eq(capabilityInstalls.agentId, params.agentId),
        eq(capabilityInstalls.packageRef, params.packageRef),
      ),
    );
}

export async function listInstalledSkillIdsForAgent(
  db: DB,
  params: { tenantId: string; agentId: string },
): Promise<string[]> {
  const installs = await db
    .select()
    .from(capabilityInstalls)
    .where(
      and(
        eq(capabilityInstalls.tenantId, params.tenantId),
        eq(capabilityInstalls.agentId, params.agentId),
        eq(capabilityInstalls.enabled, true),
      ),
    );

  if (installs.length === 0) return [];

  const refs = [...new Set(installs.map((i) => i.packageRef))];
  const pkgs = await db
    .select()
    .from(capabilityPackages)
    .where(inArray(capabilityPackages.ref, refs));

  const ids = new Set<string>();
  for (const p of pkgs) {
    const parsed = parseCapabilityManifest(p.manifest);
    for (const s of parsed.skills) {
      ids.add(s.id);
    }
  }
  return [...ids];
}

export function listCapabilityPackages(db: DB) {
  return db.select().from(capabilityPackages);
}

export function listCapabilityInstallsForAgent(
  db: DB,
  params: { tenantId: string; agentId: string },
) {
  return db
    .select()
    .from(capabilityInstalls)
    .where(
      and(
        eq(capabilityInstalls.tenantId, params.tenantId),
        eq(capabilityInstalls.agentId, params.agentId),
      ),
    );
}
