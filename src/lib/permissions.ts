import { createSupabaseAdmin } from "./supabase";

export type PermissionMap = Record<string, number>;

export interface ResolvedPermissions {
    /** Fully resolved effective permissions — true means allowed. */
    permissions: Record<string, boolean>;
    /** The highest role priority the user holds (0 if only @everyone). */
    highestPriority: number;
}

/**
 * Resolves the effective permissions for a user by folding their roles together
 * in descending priority order.
 *
 * Resolution rules:
 *   2 (allow) or 0 (deny)  → resolved; stop checking lower roles for this code
 *   1 (inherit) or missing → continue to next lower role
 *   ADMINISTRATOR = true   → all permissions become true except PLAY_GOD,
 *                            which still follows normal resolution
 */
export async function resolveUserPermissions(userId: string): Promise<ResolvedPermissions> {
    const supabase = createSupabaseAdmin();

    const [{ data: userRoles, error: urError }, { data: allPerms, error: permError }] =
        await Promise.all([
            supabase
                .from("user_role")
                .select("roles(id, priority, permissions, is_default)")
                .eq("user_id", userId),
            supabase.from("permissions").select("code"),
        ]);

    if (urError) throw new Error(`Failed to fetch user roles: ${urError.message}`);
    if (permError) throw new Error(`Failed to fetch permissions: ${permError.message}`);

    const roles = (userRoles ?? [])
        .map((ur: any) => ur.roles)
        .filter(Boolean)
        .sort((a: any, b: any) => b.priority - a.priority); // highest priority first

    const highestPriority: number = roles.length > 0 ? roles[0].priority : 0;

    const resolved: Record<string, boolean> = {};

    for (const { code } of allPerms ?? []) {
        let value: 0 | 2 | undefined;

        for (const role of roles) {
            const roleVal = (role.permissions as PermissionMap)[code];
            if (roleVal === 2 || roleVal === 0) {
                value = roleVal;
                break;
            }
            // 1 or undefined = inherit → continue to next role
        }

        resolved[code] = value === 2;
    }

    // ADMINISTRATOR grants all permissions except PLAY_GOD.
    // PLAY_GOD still follows normal resolution even for administrators.
    if (resolved["ADMINISTRATOR"]) {
        const playGod = resolved["PLAY_GOD"];
        for (const code of Object.keys(resolved)) resolved[code] = true;
        resolved["PLAY_GOD"] = playGod;
    }

    return { permissions: resolved, highestPriority };
}

/**
 * Returns the highest priority value among all non-default roles in the system.
 * Returns 0 if no non-default roles exist.
 */
export async function getSystemHighestPriority(): Promise<number> {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
        .from("roles")
        .select("priority")
        .eq("is_default", false)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

    return data?.priority ?? 0;
}

/**
 * Checks whether a user may act on a role of the given priority using the
 * given permission (MANAGE_ROLES or ASSIGN_ROLES).
 *
 * Priority rules:
 *   - User must hold the required permission.
 *   - User cannot act on roles with priority >= their own highest priority,
 *     UNLESS they have ADMINISTRATOR, or their highest role is the system's
 *     highest role (nothing outranks them).
 */
export async function canActOnRole(
    userId: string,
    targetPriority: number,
    requiredPermission: "MANAGE_ROLES" | "ASSIGN_ROLES"
): Promise<{ allowed: boolean; reason?: string }> {
    const { permissions, highestPriority } = await resolveUserPermissions(userId);

    if (!permissions[requiredPermission]) {
        return { allowed: false, reason: `Missing permission: ${requiredPermission}.` };
    }

    // ADMINISTRATOR bypasses the priority ceiling check.
    if (permissions["ADMINISTRATOR"]) return { allowed: true };

    const systemHighest = await getSystemHighestPriority();
    const userIsSystemHighest = highestPriority >= systemHighest;

    if (!userIsSystemHighest && targetPriority >= highestPriority) {
        return {
            allowed: false,
            reason: "You cannot manage roles with equal or higher priority than your own.",
        };
    }

    return { allowed: true };
}