import { z } from "zod";
import { workspaceConfigSchema } from "./schemas.js";

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
