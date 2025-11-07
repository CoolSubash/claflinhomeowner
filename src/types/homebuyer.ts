export interface UserProfile {
  id: string;
  email: string;
  role: "User" | "Counselor" | "Admin";
  credit_score?: number;
  income_net?: number;
  debts_min?: number;
  savings?: number;
  rent?: number;
  city_zip?: string;
  household?: number;
  first_time?: boolean;
  goal_type?: string;
  target_price_min?: number;
  target_price_max?: number;
  dp_pct?: number;
  willing_to_relocate?: boolean;
  target_date?: string;
  created_at: string;
}

export interface ReadinessScore {
  score: number;
  piti_low: number;
  piti_high: number;
  eta_weeks: number;
  affordability_fit: number;
  credit_band_points: number;
  reserves_months: number;
  pkt_points: number;
  breakdown: {
    affordability: { score: number; weight: number };
    credit: { score: number; weight: number };
    reserves: { score: number; weight: number };
    packet: { score: number; weight: number };
  };
}

export interface DPAProgram {
  id: string;
  name: string;
  est_amount: number;
  why_qualify: string;
  requirements: string[];
  timing: string;
  url: string;
}

export interface DocumentItem {
  type: string;
  status: "missing" | "uploaded" | "verified";
  pages?: number;
  uploaded_at?: string;
}

export interface PacketManifest {
  applicant: {
    name: string;
    dob?: string;
    ssn_last4?: string;
  };
  id: DocumentItem[];
  income: {
    employment: Array<{
      employer: string;
      pay_freq: string;
      paystubs: Array<{ period_end: string; net: number }>;
      w2?: { year: number };
    }>;
  };
  assets: Array<{
    institution: string;
    type: string;
    statements_months: number;
  }>;
  liabilities: Array<{
    creditor: string;
    min_payment: number;
  }>;
  gift_dpa: Array<{
    program: string;
    amount: number;
  }>;
  completeness: {
    percent: number;
    missing: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  step?: number;
}

export interface TimelineMilestone {
  id: string;
  title: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
  description: string;
}
