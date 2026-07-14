import type { TeamContext } from "@/lib/team/team-context"
import { getActorTeamContext, teamHasPermission } from "@/lib/team/team-context"

/** Returns team context when the user has the given permission; otherwise null. */
export async function requireTeamPermission(
  userId: string,
  permissionKey: string,
): Promise<TeamContext | null> {
  const ctx = await getActorTeamContext(userId)
  if (!ctx || ctx.memberStatus !== "active") return null
  return teamHasPermission(ctx, permissionKey) ? ctx : null
}
