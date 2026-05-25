
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // DIRECT_URL for local dev, POSTGRES_URL_NON_POOLING injected by Vercel/Supabase integration.
    // Falls back to empty string during `prisma generate` (no DB connection needed).
    url: process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "",
  },
});
