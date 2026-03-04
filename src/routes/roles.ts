import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/roles
router.get("/", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    // TODO: implement role listing
    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/new
router.post("/new", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    // TODO: ensure user has permission to create roles
    // TODO: validate name length and format (see channels/new for reference)
    // TODO: ensure role name is not already taken

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/roles/delete
router.delete("/delete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId is required" });
      return;
    }

    // TODO: ensure user has permission to delete roles
    // TODO: remove role from all users before deleting

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
