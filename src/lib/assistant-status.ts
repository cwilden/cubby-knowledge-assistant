export const ASSISTANT_STATUS = {
  answered: "answered",
  conversational: "conversational",
  medicalOrClinicalAdvice: "medical_or_clinical_advice",
  needsMoreContext: "needs_more_context",
  patientSpecificEligibility: "patient_specific_eligibility",
} as const;

export type AssistantStatus =
  (typeof ASSISTANT_STATUS)[keyof typeof ASSISTANT_STATUS];

export const ASSISTANT_STATUS_VALUES = Object.values(ASSISTANT_STATUS);

export function isAssistantStatus(value: unknown): value is AssistantStatus {
  return (
    typeof value === "string" &&
    ASSISTANT_STATUS_VALUES.includes(value as AssistantStatus)
  );
}
