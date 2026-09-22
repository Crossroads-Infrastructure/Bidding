import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default Server Action request body limit is 1MB -- too tight for
  // company logo / project document uploads (a photo of a logo before
  // resizing, or a plans PDF, can easily exceed that).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
