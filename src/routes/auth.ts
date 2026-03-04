import { Router, Request, Response } from "express";
import { createSupabaseAdmin } from "../lib/supabase";

const router = Router();
const ATLAS_DOMAIN = "@atlasstudents.com";

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required." });
      return;
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // Ensure primary Atlas email is verified
    if (!data.user.email_confirmed_at) {
      res.status(403).json({ error: "Please verify your Atlas email before signing in." });
      return;
    }

    res.status(200).json({
      message: "Signed in successfully.",
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, secondaryEmail, displayName } = req.body;

    // --- Validate required fields ---
    if (!email || !password || !displayName) {
      res.status(400).json({ error: "email, password, and displayName are required." });
      return;
    }

    // --- Enforce Atlas primary email ---
    if (!email.toLowerCase().endsWith(ATLAS_DOMAIN)) {
      res.status(400).json({ error: `Primary email must be an ${ATLAS_DOMAIN} address.` });
      return;
    }

    // --- Validate secondary email if provided ---
    if (secondaryEmail !== undefined && secondaryEmail !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(secondaryEmail)) {
        res.status(400).json({ error: "Secondary email is not a valid email address." });
        return;
      }
      if (secondaryEmail.toLowerCase().endsWith(ATLAS_DOMAIN)) {
        res.status(400).json({ error: "Secondary email must be a different domain than your Atlas email." });
        return;
      }
      if (secondaryEmail.toLowerCase() === email.toLowerCase()) {
        res.status(400).json({ error: "Secondary email must be different from your primary email." });
        return;
      }
    }

    // --- Password strength ---
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const supabase = createSupabaseAdmin();

    // --- Create user and trigger confirmation email ---
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          secondary_email: secondaryEmail || null,
          secondary_email_verified: false,
        },
      },
    });

    if (error) {
      console.error("Supabase signup error:", error.message, error.status);
      if (error.message.toLowerCase().includes("already registered")) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    // Supabase returns a user (but no email_confirmed_at) for an unverified
    // user — treat this as "pending verification", not "signed in".
    if (!data.user) {
      res.status(500).json({ error: "Account creation failed. Please try again." });
      return;
    }

    // TODO: If secondaryEmail provided, send a separate verification email to it
    //       (implement once email service is wired up)

    res.status(201).json({
      message: "Account created. Please check your Atlas email to verify your account.",
      userId: data.user.id,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
