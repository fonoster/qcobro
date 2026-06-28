import type { UserSettingsClient, UserSettingsRecord } from "@qcobro/common";

/**
 * Resolve a user's settings, seeding a default row the first time the user is seen. The
 * default (language `es`) comes from the `UserSettings` column default, so every user always
 * resolves a language without ever touching Identity.
 */
export function createGetUserSettings(client: UserSettingsClient) {
  return async (userRef: string): Promise<UserSettingsRecord> => {
    const existing = await client.userSettings.findUnique({ where: { userRef } });
    if (existing) return existing;
    return client.userSettings.upsert({
      where: { userRef },
      create: { userRef },
      update: {}
    });
  };
}
