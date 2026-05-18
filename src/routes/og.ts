import { Router } from "express";
import ogs from "open-graph-scraper";

const router = Router();

router.get("/", async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid URL parameter" });
  }

  try {
    const options = { url };
    const { result, error } = await ogs(options);

    if (error) {
      console.error("OGS Error:", result);
      return res.status(500).json({ error: "Failed to fetch metadata" });
    }

    // Map result to the format expected by the React component:
    // {
    //   title?: string;
    //   description?: string;
    //   image?: string;
    //   siteName?: string;
    // }
    
    // ogs returns ogImage as an array of objects
    const image = result.ogImage && result.ogImage.length > 0 
      ? result.ogImage[0].url 
      : undefined;

    const metadata = {
      title: result.ogTitle,
      description: result.ogDescription,
      image: image,
      siteName: result.ogSiteName,
    };

    res.json(metadata);
  } catch (err: any) {
    console.error("OG Error:", err.message);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

export default router;
