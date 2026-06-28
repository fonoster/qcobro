import type { Language } from "../schemas/userSettings.js";

export interface UserSettingsRecord {
  userRef: string;
  language: Language;
  createdAt: Date;
  updatedAt: Date;
}

/** The DB surface the user-settings functions need (tests inject a stub). */
export interface UserSettingsClient {
  userSettings: {
    findUnique(args: { where: { userRef: string } }): Promise<UserSettingsRecord | null>;

    upsert(args: {
      where: { userRef: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<UserSettingsRecord>;
  };
}
