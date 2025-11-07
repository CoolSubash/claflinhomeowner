import { UserProfile, DPAProgram } from "@/types/homebuyer";

export const DEMO_USER: UserProfile = {
  id: "demo-janelle",
  email: "janelle.demo@homekey.coach",
  role: "User",
  credit_score: 630,
  income_net: 3900,
  debts_min: 270,
  savings: 6200,
  rent: 1300,
  city_zip: "27610",
  household: 2,
  first_time: true,
  goal_type: "Single-family",
  target_price_min: 180000,
  target_price_max: 210000,
  dp_pct: 3,
  willing_to_relocate: false,
  created_at: new Date().toISOString(),
};

export const NC_DPA_PROGRAMS: DPAProgram[] = [
  {
    id: "nc-home-advantage",
    name: "NC Home Advantage Mortgage™",
    est_amount: 5700,
    why_qualify: "You're a first-time buyer in NC with income under area limits",
    requirements: [
      "First-time homebuyer or not owned home in 3 years",
      "Credit score 620+",
      "Income limits by county",
      "Complete homebuyer education",
    ],
    timing: "2-3 weeks to pre-qualify",
    url: "https://www.nchfa.com/home-buyers/home-advantage-mortgage",
  },
  {
    id: "nc-first-home",
    name: "NC 1st Home Advantage Down Payment",
    est_amount: 15000,
    why_qualify: "Available for qualified first-time buyers; can cover down payment and closing costs",
    requirements: [
      "Must be used with NC Home Advantage Mortgage",
      "Income and purchase price limits apply",
      "Complete homebuyer education",
      "Property must be primary residence",
    ],
    timing: "Available at closing (concurrent with mortgage)",
    url: "https://www.nchfa.com/home-buyers/down-payment-assistance",
  },
  {
    id: "raleigh-dpa",
    name: "City of Raleigh Homebuyer Assistance",
    est_amount: 40000,
    why_qualify: "Raleigh residents can receive up to $60k in zero-interest, deferred assistance",
    requirements: [
      "Household income at or below 80% AMI",
      "Purchase home within Raleigh city limits",
      "Complete housing counseling",
      "Contribute minimum $1,000 from own funds",
    ],
    timing: "4-6 weeks application to approval",
    url: "https://raleighnc.gov/services/housing/homebuyer-assistance-program",
  },
];

export const REQUIRED_DOCUMENTS = [
  { type: "driver_license", label: "Driver's License or ID", category: "id" },
  { type: "paystub_recent", label: "Recent Paystub (within 30 days)", category: "income" },
  { type: "paystub_prior", label: "Prior Paystub (2nd most recent)", category: "income" },
  { type: "w2_2024", label: "W-2 for 2024", category: "income" },
  { type: "bank_stmt_month1", label: "Bank Statement - Month 1", category: "assets" },
  { type: "bank_stmt_month2", label: "Bank Statement - Month 2", category: "assets" },
  { type: "credit_report", label: "Credit Report (soft pull)", category: "credit" },
];
