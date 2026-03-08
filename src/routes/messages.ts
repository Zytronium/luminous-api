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
    if (!newContent?.trim()) {
      res.status(400).json({ error: "newContent is required" });
      return;
    }

    const supabase = createSupabaseAdmin();

    // Fetch the message to verify ownership and retrieve channel_id for broadcast
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("user_id, channel_id")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (message.user_id !== req.userId) {
      res.status(403).json({ error: "You can only edit your own messages" });
      return;
    }

    const trimmed = newContent.trim();

    const { error: updateError } = await supabase
      .from("messages")
      .update({ content: trimmed })
      .eq("id", messageId);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }


    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Edit error:", err);
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

    const supabase = createSupabaseAdmin();

    // Fetch the message to verify ownership and retrieve channel_id for broadcast
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("user_id, channel_id")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    // TODO: also allow users with a role that has permission to delete messages

    if (message.user_id !== req.userId) {
      res.status(403).json({ error: "You can only delete your own messages" });
      return;
    }

    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }


    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err);
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
