export { parseCapabilityManifest } from "./manifest";
export type { ParsedCapabilityManifest } from "./manifest";
export {
  applyManifestSkills,
  disableCapabilityForAgent,
  installCapabilityForAgent,
  listCapabilityInstallsForAgent,
  listCapabilityPackages,
  listInstalledSkillIdsForAgent,
  upsertCapabilityPackage,
} from "./registry";
export { ensureDemoCapabilityPack } from "./demo-pack";
