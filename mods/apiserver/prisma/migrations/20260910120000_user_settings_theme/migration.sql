-- Per-user console appearance preference. Mirrors `language`: app-owned, stored here (never
-- in the Identity service), seeded lazily on first read via the column DEFAULT.
--
-- "system" means follow the operating system's prefers-color-scheme; "light"/"dark" pin a
-- theme. Additive and non-breaking: every existing row backfills to "system", which renders
-- identically to today unless the user's OS is set to dark.
ALTER TABLE "user_settings" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system';
