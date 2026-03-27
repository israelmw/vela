"use server";

import { revalidatePath } from "next/cache";
import { syncAllMcpServersForTenant } from "../../lib/mcp-autosync";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function syncAllMcpAction() {
  await syncAllMcpServersForTenant(DEFAULT_TENANT_ID);
  revalidatePath("/mcp");
}
