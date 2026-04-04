import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";
import { canActOnRole, resolveUserPermissions } from "../lib/permissions";

const router = Router();

// GET /api/roles
// Returns all roles sorted by priority descending.
router.get("/", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("roles")
      .select("id, name, description, priority, color, permissions, is_default, created_at, updated_at")
      .order("priority", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/new
// Creates a new role at the top of the priority stack.
// Requires: MANAGE_ROLES
// NOTE: registered before /:id so "/new" is not captured as a role ID.
router.post("/new", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, color } = req.body;

    const nameError = validateRoleName(name);
    if (nameError) {
      res.status(400).json({ error: nameError });
      return;
    }

    if (color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      res.status(400).json({ error: "color must be a valid hex code (e.g. #FF5733)." });
      return;
    }

    const { permissions } = await resolveUserPermissions(req.userId!);
    if (!permissions["MANAGE_ROLES"]) {
      res.status(403).json({ error: "Missing permission: MANAGE_ROLES." });
      return;
    }

    const supabase = createSupabaseAdmin();

    // Enforce unique role name (case-insensitive)
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .ilike("name", name.trim())
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: "A role with this name already exists." });
      return;
    }

    // New roles are created at the top of the stack (current max + 1).
    const { data: topRole } = await supabase
      .from("roles")
      .select("priority")
      .eq("is_default", false)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPriority = (topRole?.priority ?? 0) + 1;

    const { data: role, error } = await supabase
      .from("roles")
      .insert({
        name: name.trim(),
        description: description?.trim() ?? null,
        color: color ?? "#FCFCFC",
        priority: newPriority,
        permissions: {},
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(role);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/reorder
// Atomically reassigns priorities based on a caller-supplied ordering.
// Body: { order: string[] } — array of non-default role IDs, highest priority first.
// The DB assigns priority N (highest) down to 1 (lowest non-default).
// Requires: MANAGE_ROLES
// NOTE: registered before /:id so "/reorder" is not captured as a role ID.
router.post("/reorder", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      res.status(400).json({ error: "order must be a non-empty array of role IDs." });
      return;
    }

    if (order.some((id) => typeof id !== "string")) {
      res.status(400).json({ error: "All entries in order must be strings." });
      return;
    }

    const { permissions } = await resolveUserPermissions(req.userId!);
    if (!permissions["MANAGE_ROLES"]) {
      res.status(403).json({ error: "Missing permission: MANAGE_ROLES." });
      return;
    }

    const supabase = createSupabaseAdmin();

    // Verify all IDs exist and are non-default roles
    const { data: roles, error: fetchError } = await supabase
      .from("roles")
      .select("id, is_default")
      .in("id", order);

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if ((roles ?? []).length !== order.length) {
      res.status(400).json({ error: "One or more role IDs are invalid." });
      return;
    }

    if ((roles ?? []).some((r) => r.is_default)) {
      res.status(400).json({ error: "The @everyone role cannot be reordered." });
      return;
    }

    // Atomically reassign priorities via a DB function.
    // The function runs inside a single transaction, so the DEFERRABLE INITIALLY
    // DEFERRED unique constraint on priority won't fire until it commits.
    const { error: rpcError } = await supabase.rpc("reorder_roles", { role_ids: order });

    if (rpcError) {
      res.status(500).json({ error: rpcError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/roles/:id
// Edits a role's name, description, color, and/or permissions map.
// The @everyone role is intentionally excluded. Edit it directly in Supabase.
// Requires: MANAGE_ROLES + sufficient priority.
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, color, permissions } = req.body;

    const supabase = createSupabaseAdmin();

    const { data: role, error: fetchError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !role) {
      res.status(404).json({ error: "Role not found." });
      return;
    }

    if (role.is_default) {
      res.status(403).json({ error: "The @everyone role cannot be edited through this endpoint." });
      return;
    }

    const check = await canActOnRole(req.userId!, role.priority, "MANAGE_ROLES");
    if (!check.allowed) {
      res.status(403).json({ error: check.reason });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      const nameError = validateRoleName(name);
      if (nameError) {
        res.status(400).json({ error: nameError });
        return;
      }

      // Enforce unique name (case-insensitive), excluding this role itself
      const { data: conflict } = await supabase
        .from("roles")
        .select("id")
        .ilike("name", name.trim())
        .neq("id", id)
        .maybeSingle();

      if (conflict) {
        res.status(409).json({ error: "A role with this name already exists." });
        return;
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() ?? null;
    }

    if (color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        res.status(400).json({ error: "color must be a valid hex code (e.g. #FF5733)." });
        return;
      }
      updates.color = color;
    }

    if (permissions !== undefined) {
      if (typeof permissions !== "object" || Array.isArray(permissions)) {
        res.status(400).json({ error: "permissions must be an object." });
        return;
      }
      for (const [code, val] of Object.entries(permissions)) {
        if (![0, 1, 2].includes(val as number)) {
          res.status(400).json({
            error: `Invalid value for permission "${code}": must be 0 (deny), 1 (inherit), or 2 (allow).`,
          });
          return;
        }
      }
      updates.permissions = permissions;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields provided." });
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from("roles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.status(200).json(updated);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/roles/delete
// Deletes a role and removes it from all users (via ON DELETE CASCADE).
// The @everyone role cannot be deleted.
// Requires: MANAGE_ROLES + sufficient priority.
router.delete("/delete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required." });
      return;
    }

    const supabase = createSupabaseAdmin();

    const { data: role, error: fetchError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", roleId)
      .single();

    if (fetchError || !role) {
      res.status(404).json({ error: "Role not found." });
      return;
    }

    if (role.is_default) {
      res.status(403).json({ error: "The @everyone role cannot be deleted." });
      return;
    }

    const check = await canActOnRole(req.userId!, role.priority, "MANAGE_ROLES");
    if (!check.allowed) {
      res.status(403).json({ error: check.reason });
      return;
    }

    const { error: deleteError } = await supabase.from("roles").delete().eq("id", roleId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

function validateRoleName(name: unknown): string | null {
  if (!name || typeof name !== "string" || !name.trim()) return "name is required.";
  if (name.trim().length < 2) return "name must be at least 2 characters.";
  if (name.trim().length > 32) return "name cannot exceed 32 characters.";
  return null;
}

export default router;
