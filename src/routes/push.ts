import { Router, Response } from "express";
import webpush from "web-push";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();

webpush.setVapidDetails(
    process.env.VAPID_MAILTO!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

// POST /api/push/subscribe
// Body: { endpoint: string, keys: { p256dh: string, auth: string } }
// Upserts a Web Push subscription for the authenticated user.
router.post("/subscribe", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint, keys } = req.body as {
            endpoint?: string;
            keys?: { p256dh?: string; auth?: string };
        };

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            res.status(400).json({ error: "endpoint, keys.p256dh, and keys.auth are required" });
            return;
        }

        const supabase = createSupabaseAdmin();
        const { error } = await supabase
            .from("push_subscriptions")
            .upsert(
                { user_id: req.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
                { onConflict: "user_id,endpoint" },
            );

        if (error) {
            console.log(error.message);
            res.status(500).json({ error: error.message });
            return;
        }

        res.status(201).json({ ok: true });
    } catch (_) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE /api/push/subscribe
// Body: { endpoint: string }
// Removes a specific Web Push subscription (e.g. on logout).
router.delete("/subscribe", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint } = req.body as { endpoint?: string };

        if (!endpoint) {
            res.status(400).json({ error: "endpoint is required" });
            return;
        }

        const supabase = createSupabaseAdmin();
        const { error } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", req.userId)
            .eq("endpoint", endpoint);

        if (error) {
            console.log(error.message)
            res.status(500).json({ error: error.message });
            return;
        }

        res.status(200).json({ ok: true });
    } catch (_) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Sends a Web Push notification to every subscription belonging to a set of
 * users, skipping the sender. Stale/expired subscriptions (410 Gone) are
 * pruned automatically.
 *
 * @param recipientUserIds  User IDs to notify
 * @param excludeUserId     The sending user — never notify them via Web Push
 * @param payload           Notification payload forwarded to the service worker
 */
export async function sendWebPushToUsers(
    recipientUserIds: string[],
    excludeUserId: string,
    payload: {
        title: string;
        body: string;
        channelId: string;
        messageId: string;
    },
): Promise<void> {
    const targets = recipientUserIds.filter((id) => id !== excludeUserId);
    if (targets.length === 0) return;

    const supabase = createSupabaseAdmin();
    const { data: subs, error } = await supabase
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", targets);

    if (error || !subs?.length) return;

    const staleEndpoints: string[] = [];

    await Promise.allSettled(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify(payload),
                );
            } catch (err: any) {
                // 410 Gone = subscription revoked by the browser; prune it.
                if (err?.statusCode === 410) {
                    staleEndpoints.push(sub.endpoint);
                } else {
                    console.warn("Web Push delivery failed:", err?.statusCode, sub.endpoint);
                }
            }
        }),
    );

    if (staleEndpoints.length) {
        await supabase
            .from("push_subscriptions")
            .delete()
            .in("endpoint", staleEndpoints);
    }
}

export default router;