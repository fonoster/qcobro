import { z } from "zod";

/** Input for the strict E.164 phone validator (see `utils/validatePhone.ts`). */
export const phoneNumberSchema = z.object({
  phone: z.string().min(1, "phone is required")
});
export type ValidatePhoneInput = z.infer<typeof phoneNumberSchema>;
