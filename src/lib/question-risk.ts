export const QUESTION_RISK = {
  generalInformation: "GENERAL_INFORMATION",
  highRiskCoverage: "HIGH_RISK_COVERAGE",
  medicalOrClinicalAdvice: "MEDICAL_OR_CLINICAL_ADVICE",
  patientSpecificEligibility: "PATIENT_SPECIFIC_ELIGIBILITY",
} as const;

export type QuestionRisk = (typeof QUESTION_RISK)[keyof typeof QUESTION_RISK];

const AGE_PATTERN =
  /\b(?:\d{1,2}\s*(?:-| )?\s*(?:year|yr)s?\s*old|\d{1,2}\s*y\/o|child|kid|patient|my son|my daughter|my loved one)\b/i;
const CONDITION_PATTERN =
  /\b(?:adhd|autism|autistic|cerebral palsy|condition|developmental|diagnos(?:is|ed)|down syndrome|elopement|epilepsy|medical history|seizure|seizures|self-injur(?:y|ious)|sensory)\b/i;
const COVERAGE_PATTERN =
  /\b(?:approve|approval|authorization|authorize|cover|coverage|covered|eligible|eligibility|fund|funding|insurance|medicaid|payer|payor|policy|qualify|reimburse|reimbursement)\b/i;
const INDIVIDUAL_CIRCUMSTANCE_PATTERN =
  /\b(?:case|family|for her|for him|for my|for our|individual|my child|my patient|our patient|specific|this child|this patient|this request)\b/i;
const MEDICAL_ADVICE_PATTERN =
  /\b(?:clinical advice|diagnose|medical advice|prescribe|recommend treatment|safe for|treat|treatment plan)\b/i;
const PAYER_PATTERN =
  /\b(?:aetna|anthem|blue cross|bcbs|cigna|humana|insurance|kaiser|medicaid|medicare|payer|payor|tricare|united healthcare|uhc)\b/i;
const STATE_PATTERN =
  /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

export function classifyQuestionRisk(question: string): QuestionRisk {
  const hasCoverageLanguage = COVERAGE_PATTERN.test(question);
  const hasPatientAttributes =
    AGE_PATTERN.test(question) ||
    CONDITION_PATTERN.test(question) ||
    INDIVIDUAL_CIRCUMSTANCE_PATTERN.test(question) ||
    ((PAYER_PATTERN.test(question) || STATE_PATTERN.test(question)) &&
      INDIVIDUAL_CIRCUMSTANCE_PATTERN.test(question));

  if (hasCoverageLanguage && hasPatientAttributes) {
    return QUESTION_RISK.patientSpecificEligibility;
  }

  if (MEDICAL_ADVICE_PATTERN.test(question)) {
    return QUESTION_RISK.medicalOrClinicalAdvice;
  }

  if (hasCoverageLanguage) {
    return QUESTION_RISK.highRiskCoverage;
  }

  return QUESTION_RISK.generalInformation;
}
