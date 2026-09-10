import {
  updateUserThemeSchema,
  withErrorHandlingAndValidation,
  type UpdateUserThemeInput,
  type UserSettingsClient,
  type UserSettingsRecord
} from "@qcobro/common";

/**
 * Update a user's console appearance preference. Upserts so a user who has never had a
 * settings row gets one. An unsupported value is rejected by validation before any write.
 */
export function createUpdateUserTheme(client: UserSettingsClient, userRef: string) {
  const fn = (input: UpdateUserThemeInput): Promise<UserSettingsRecord> =>
    client.userSettings.upsert({
      where: { userRef },
      create: { userRef, theme: input.theme },
      update: { theme: input.theme }
    });
  return withErrorHandlingAndValidation(fn, updateUserThemeSchema);
}
