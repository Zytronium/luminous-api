import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();

// POST /api/messages/send
router.post("/send", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { channelId, content, repliesTo } = req.body;

    if (!channelId || !content?.trim()) {
      res.status(400).json({ error: "channelId and content are required" });
      return;
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      user_id: req.userId,
      content: content.trim(),
      replies_to: repliesTo ?? null,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ ok: true });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/messages/edit
router.patch("/edit", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, newContent } = req.body;

    if (!messageId) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }
    if (!newContent) {
      res.status(400).json({ error: "newContent is required" });
      return;
    }

    // TODO: ensure user owns the message or has permission to edit it

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/messages/delete
router.delete("/delete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }

    // TODO: ensure user owns the message or has permission to delete it

    res.status(501).json({ message: "Not implemented yet" });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages/react
router.post("/react", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, emoji } = req.body;

    if (!messageId) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }
    if (!emoji) {
      res.status(400).json({ error: "emoji is required" });
      return;
    }

    // TODO: validate messageId is a valid ID
    // TODO: ensure emoji is a valid emoji

    res.status(501).json({ message: "Not implemented yet." });
  } catch (_) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
