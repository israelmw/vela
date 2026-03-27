/**
 * Extract user text from a Bot Framework Activity (Teams inbound JSON).
 */
export function getTeamsActivityText(activity: unknown): string {
  if (!activity || typeof activity !== "object") return "";
  const a = activity as Record<string, unknown>;
  if (typeof a.text === "string" && a.text.trim()) {
    return a.text.trim();
  }
  const value = a.value;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
  }
  return "";
}

export function teamsConversationRef(activity: unknown): string {
  if (!activity || typeof activity !== "object") return "teams:unknown";
  const a = activity as Record<string, unknown>;
  const conv = a.conversation as Record<string, unknown> | undefined;
  const id =
    conv && typeof conv.id === "string"
      ? conv.id
      : typeof a.id === "string"
        ? a.id
        : "main";
  return `teams:${id}`;
}
