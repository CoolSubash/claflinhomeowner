export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  // Presentational only - which nav links to show. Every real
  // authorization decision is still re-checked on the backend.
  roles: string[];
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_role: string;
  rating: number;
  content: string;
  created_at: string;
}

export type AssessmentStatus = "DRAFT" | "SUBMITTED" | "PROCESSING" | "COMPLETED" | "FAILED";

// Money and employment_years come back from the API as decimal-string
// JSON values (e.g. "72000.00"), not numbers - matching exactly what the
// backend returns avoids silent precision loss in the browser.
export interface Assessment {
  id: string;
  user_id: string;
  status: AssessmentStatus;
  income: string | null;
  monthly_debt: string | null;
  credit_score: number | null;
  savings: string | null;
  down_payment: string | null;
  target_home_price: string | null;
  employment_years: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  weight: number;
  raw_value: number;
  explanation: string;
}

export interface ReadinessResult {
  id: string;
  assessment_id: string;
  scoring_version: string;
  overall_score: number;
  readiness_level: string;
  created_at: string;
  components: ScoreBreakdown[];
}

export interface ReadinessResultSummary {
  id: string;
  assessment_id: string;
  scoring_version: string;
  overall_score: number;
  readiness_level: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  readiness_result_id: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  source: string;
  created_at: string;
}

export interface RealEstatePartner {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

export interface ConnectionRequestForRealtor {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  requester_name: string;
  consent_given_at: string;
  created_at: string;
  updated_at: string;
}

export interface RealtorInviteLookup {
  email: string;
  account_exists: boolean;
}

export interface ChatSession {
  id: string;
  title: string | null;
  assessment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  created_at: string;
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

export interface ChatMessageExchange {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}
