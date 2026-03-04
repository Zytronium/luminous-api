import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();

// GET /api/users/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: validate id is a valid user ID
    void id;
    void createSupabaseAdmin; // will be used when implemented

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: add body params (display name, avatar, about, etc.)
    // TODO: ensure user is editing their own profile or is an app admin
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id/roles
router.get("/:id/roles", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: validate id is a valid user ID
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:id/roles/add
router.post("/:id/roles/add", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required" });
      return;
    }

    // TODO: ensure user has permission to assign roles
    // TODO: validate roleId is a valid ID
    // TODO: ensure role is not already assigned to user
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id/roles/remove
router.delete("/:id/roles/remove", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required" });
      return;
    }

    // TODO: ensure user has permission to remove roles
    // TODO: ensure role is currently assigned to user before removing
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
