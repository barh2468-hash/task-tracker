import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MAYA – מערכת איתור תשתיות",
    short_name: "MAYA",
    description: "ניהול פרויקטים, משימות, יומני עבודה ועדכוני שטח",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#eef5fb",
    theme_color: "#0b2348",
    lang: "he",
    dir: "rtl",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
