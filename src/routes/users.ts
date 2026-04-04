import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";
import { canActOnRole } from "../lib/permissions";

const router = Router();

// GET /api/users
// Returns all user profiles, sorted by display name.
router.get("/", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .order("display_name", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id
// Returns a single user's profile.
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:id
// Updates a user's own profile. Users may only edit their own profile.
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      res.status(403).json({ error: "You can only edit your own profile." });
      return;
    }

    const { displayName } = req.body;

    if (!displayName?.trim()) {
      res.status(400).json({ error: "displayName is required." });
      return;
    }

    if (displayName.trim().length < 2) {
      res.status(400).json({ error: "displayName must be at least 2 characters." });
      return;
    }

    if (displayName.trim().length > 32) {
      res.status(400).json({ error: "displayName cannot exceed 32 characters." });
      return;
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id/roles
// Returns all roles assigned to a user, sorted by priority descending.
router.get("/:id/roles", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createSupabaseAdmin();

    // Verify user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!profile) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const { data, error } = await supabase
        .from("user_role")
        .select("role:roles(id, name, description, priority, color, is_default, permissions), assigned_at, assigned_by")
        .eq("user_id", id)
        .order("priority", { foreignTable: "roles", ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:id/roles/add
// Assigns a role to a user.
// Requires: ASSIGN_ROLES + sufficient priority.
// The @everyone role cannot be manually assigned (it is auto-assigned on signup).
router.post("/:id/roles/add", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required." });
      return;
    }

    const supabase = createSupabaseAdmin();

    // Verify target user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!profile) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Fetch the role being assigned
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, priority, is_default")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      res.status(404).json({ error: "Role not found." });
      return;
    }

    if (role.is_default) {
      res.status(400).json({ error: "The @everyone role is assigned automatically and cannot be manually assigned." });
      return;
    }

    const check = await canActOnRole(req.userId!, role.priority, "ASSIGN_ROLES");
    if (!check.allowed) {
      res.status(403).json({ error: check.reason });
      return;
    }

    // Check if already assigned
    const { data: existing } = await supabase
      .from("user_role")
      .select("role_id")
      .eq("user_id", id)
      .eq("role_id", roleId)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: "This role is already assigned to the user." });
      return;
    }

    const { error: insertError } = await supabase.from("user_role").insert({
      user_id: id,
      role_id: roleId,
      assigned_by: req.userId,
    });

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    res.status(201).json({ ok: true });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id/roles/remove
// Removes a role from a user.
// Requires: ASSIGN_ROLES + sufficient priority.
// The @everyone role cannot be manually removed.
router.delete("/:id/roles/remove", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required." });
      return;
    }

    const supabase = createSupabaseAdmin();

    // Fetch the role being removed
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, priority, is_default")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      res.status(404).json({ error: "Role not found." });
      return;
    }

    if (role.is_default) {
      res.status(400).json({ error: "The @everyone role cannot be manually removed." });
      return;
    }

    const check = await canActOnRole(req.userId!, role.priority, "ASSIGN_ROLES");
    if (!check.allowed) {
      res.status(403).json({ error: check.reason });
      return;
    }

    // Verify the role is actually assigned before attempting removal
    const { data: assignment } = await supabase
      .from("user_role")
      .select("role_id")
      .eq("user_id", id)
      .eq("role_id", roleId)
      .maybeSingle();

    if (!assignment) {
      res.status(404).json({ error: "This role is not assigned to the user." });
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_role")
      .delete()
      .eq("user_id", id)
      .eq("role_id", roleId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
