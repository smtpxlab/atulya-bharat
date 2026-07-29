import { supabase } from "@/integrations/supabase/client";
import { contactEnquirySchema, type ContactEnquiryInput } from "@/schemas/contact.schema";
import { toServiceError } from "./errors";

export interface SubmitEnquiryPayload extends ContactEnquiryInput {
  /** Honeypot — must remain empty for real users. */
  website?: string;
}

export const submitEnquiry = async (input: SubmitEnquiryPayload): Promise<void> => {
  const parsed = contactEnquirySchema.safeParse(input);
  if (!parsed.success) {
    throw toServiceError(parsed.error, parsed.error.issues[0]?.message ?? "Invalid enquiry");
  }

  const { data, error } = await supabase.functions.invoke<{ success: boolean; message: string }>(
    "contact-form",
    { body: { ...parsed.data, website: input.website ?? "" } },
  );

  if (error) throw toServiceError(error, "Unable to send your message. Please try again later.");
  if (!data?.success) {
    throw toServiceError(new Error(data?.message ?? "failed"), data?.message ?? "Unable to send your message. Please try again later.");
  }
};
