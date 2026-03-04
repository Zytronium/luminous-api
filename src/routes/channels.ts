import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();

// GET /api/channels
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("channels")
      .select("id, name, description")
      .order("name", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json(data);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/channels/:id/messages
router.get("/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createSupabaseAdmin();

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, user_id, content, created_at, replies_to")
      .eq("channel_id", id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (msgError) {
      res.status(500).json({ error: msgError.message });
      return;
    }

    if (!messages?.length) {
      res.status(200).json([]);
      return;
    }

    // Fetch profiles for all unique user_ids in this batch
    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profileError) {
      res.status(500).json({ error: profileError.message });
      return;
    }

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.display_name])
    );

    const result = messages.map((m) => ({
      ...m,
      profiles: { display_name: profileMap[m.user_id] ?? "Unknown" },
    }));

    res.status(200).json(result);
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/channels/new
router.post("/new", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    // validate name
    const nameError = validateChannelName(name);
    if (nameError) {
      res.status(400).json({ error: nameError });
      return;
    }

    // TODO: ensure user has permission to create channels

    res.status(501).json({ message: "Not implemented yet." });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/channels/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: add more body params
    // TODO: ensure user has permission to edit channels
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/channels/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // TODO: ensure user has permission to delete channels
    void id;

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

function validateChannelName(name: string): string | null {
  if (!name) return "name is required";
  if (name.trim().length > 32) return "name cannot be longer than 32 characters";
  if (name.trim().length <= 1) return "name must be at least 2 characters";
  if (/\s/.test(name)) return "name cannot contain whitespace";
  return null;
}

export default router;
