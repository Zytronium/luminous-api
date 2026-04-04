import { Router, Request, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();

// GET /api/permissions
// Returns all permissions sorted alphabetically by code.
router.get("/", requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from("permissions")
            .select("id, code, name, description, created_at, updated_at")
            .order("code", { ascending: true });

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.status(200).json(data);
    } catch (_) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
