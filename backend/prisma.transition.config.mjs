import { defineConfig } from "prisma/config";
import { restoreConfig } from "./scripts/lib/restore-target.js";

export default defineConfig({
  schema: "prisma/transition/schema.prisma",
  datasource: { url: restoreConfig().url },
});
