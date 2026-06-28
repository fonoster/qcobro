import {
  updateUserLanguageSchema,
  withErrorHandlingAndValidation,
  type UpdateUserLanguageInput,
  type UserSettingsClient,
  type UserSettingsRecord
} from "@qcobro/common";

/**
 * Update a user's console language. Upserts so a user who has never had a settings row gets
 * one. An unsupported language is rejected by validation before any write.
 */
export function createUpdateUserLanguage(client: UserSettingsClient, userRef: string) {
  const fn = (input: UpdateUserLanguageInput): Promise<UserSettingsRecord> =>
    client.userSettings.upsert({
      where: { userRef },
      create: { userRef, language: input.language },
      update: { language: input.language }
    });
  return withErrorHandlingAndValidation(fn, updateUserLanguageSchema);
}
