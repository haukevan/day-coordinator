import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Day Coordinator",
    short_name: "DayCoord",
    description:
      "Real-time event coordination for weddings and private events.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f6f2",
    theme_color: "#1a2b3d",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
