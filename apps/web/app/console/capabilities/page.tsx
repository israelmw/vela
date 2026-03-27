import { redirect } from "next/navigation";

/** @deprecated Use `/console/skills` — kept for bookmarks and old links. */
export default function LegacyConsoleCapabilitiesRedirect() {
  redirect("/console/skills");
}
