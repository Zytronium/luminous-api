import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import channelRoutes from "./routes/channels";
import messageRoutes from "./routes/messages";
import roleRoutes from "./routes/roles";
import userRoutes from "./routes/users";

const app = express();
const PORT = process.env.PORT ?? 4000;

// -- CORS ---------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Electron in dev)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// -- Body parsing --------------------------------------------------------------
app.use(express.json());

// -- Routes --------------------------------------------------------------------
app.use("/api/auth", authRoutes);
// Both singular and plural paths are supported to match the original Next.js API:
//   /api/channel/new, /api/channel/:id/messages, /api/channel/:id  (singular)
//   /api/channels                                                   (plural list)
app.use("/api/channel", channelRoutes);
app.use("/api/channels", channelRoutes);
//   /api/message/send, /api/message/edit, /api/message/delete, /api/message/react  (singular)
//   /api/messages/...                                                               (plural alias)
app.use("/api/message", messageRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

// -- Health check --------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// -- 404 fallback --------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Luminous API running on port ${PORT}`);
});

export default app;
