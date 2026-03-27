import type { DB } from "@vela/db";
import { installCapabilityForAgent, upsertCapabilityPackage } from "./registry";

const DEMO_REF = "vela.demo-oss-pack";

/** Idempotent demo OSS capability pack + install for the default agent (dev bootstrap). */
export async function ensureDemoCapabilityPack(
  db: DB,
  params: { tenantId: string; agentId: string },
): Promise<void> {
  const manifest = {
    description: "Demo OSS capability pack (marketplace v3 scaffold).",
    skills: [
      {
        id: "demo-pack-skill",
        name: "Demo pack skill",
        description: "Skill shipped inside the demo OSS capability pack.",
        version: "0.0.1",
        instructions:
          "When this skill is active, acknowledge capability pack installation in answers.",
        requiredTools: ["vela.echo"],
        requiredMcp: [],
        files: [],
      },
    ],
    tools: ["vela.echo"],
  };

  await upsertCapabilityPackage(db, {
    ref: DEMO_REF,
    name: "Vela demo OSS pack",
    version: "0.0.1",
    manifest,
    source: "dev-seed",
  });

  await installCapabilityForAgent(db, {
    tenantId: params.tenantId,
    agentId: params.agentId,
    packageRef: DEMO_REF,
  });
}
