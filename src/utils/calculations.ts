import { UserProfile, ReadinessScore } from "@/types/homebuyer";

const CREDIT_THRESHOLD = 640;
const AFFORDABILITY_MIN = 0.28;
const AFFORDABILITY_MAX = 0.38;

export function calculatePITI(
  homePrice: number,
  downPaymentPct: number,
  zip: string = "27610"
): { low: number; high: number } {
  const loanAmount = homePrice * (1 - downPaymentPct / 100);
  const monthlyRate = 0.07 / 12; // 7% APR assumption
  const months = 360;
  
  const pi = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
             (Math.pow(1 + monthlyRate, months) - 1);
  
  // Rough estimates for taxes and insurance based on NC averages
  const propertyTax = (homePrice * 0.0085) / 12;
  const insurance = homePrice * 0.0035 / 12;
  
  const piti = pi + propertyTax + insurance;
  
  return {
    low: Math.round(piti * 0.95),
    high: Math.round(piti * 1.05),
  };
}

export function calculateAffordabilityFit(
  pitiMid: number,
  netIncome: number
): number {
  const ratio = pitiMid / netIncome;
  
  if (ratio < AFFORDABILITY_MIN) return 100;
  if (ratio > AFFORDABILITY_MAX) return 0;
  
  // Linear scale between 28% and 38%
  const range = AFFORDABILITY_MAX - AFFORDABILITY_MIN;
  const position = ratio - AFFORDABILITY_MIN;
  return Math.round(100 * (1 - position / range));
}

export function calculateCreditPoints(creditScore: number): number {
  if (creditScore >= CREDIT_THRESHOLD) return 100;
  if (creditScore < 580) return 0;
  
  // Linear scale from 580 to 640
  return Math.round(((creditScore - 580) / (CREDIT_THRESHOLD - 580)) * 100);
}

export function calculateReservesPoints(
  savings: number,
  dpaAmount: number,
  pitiMid: number
): number {
  const totalReserves = savings + dpaAmount;
  const monthsOfPITI = totalReserves / pitiMid;
  
  if (monthsOfPITI >= 2) return 100;
  if (monthsOfPITI <= 0) return 0;
  
  return Math.round((monthsOfPITI / 2) * 100);
}

export function calculatePacketPoints(completeness: number): number {
  return Math.round(completeness);
}

export function calculateReadinessScore(
  profile: UserProfile,
  dpaAmount: number,
  packetCompleteness: number
): ReadinessScore {
  const targetPrice = ((profile.target_price_min || 0) + (profile.target_price_max || 0)) / 2;
  const piti = calculatePITI(targetPrice, profile.dp_pct || 3, profile.city_zip);
  const pitiMid = (piti.low + piti.high) / 2;
  
  const affordability = calculateAffordabilityFit(pitiMid, profile.income_net || 0);
  const credit = calculateCreditPoints(profile.credit_score || 0);
  const reserves = calculateReservesPoints(profile.savings || 0, dpaAmount, pitiMid);
  const packet = calculatePacketPoints(packetCompleteness);
  
  const score = Math.round(
    affordability * 0.40 +
    credit * 0.25 +
    reserves * 0.20 +
    packet * 0.15
  );
  
  // Calculate ETA
  const downPayment = targetPrice * ((profile.dp_pct || 3) / 100);
  const closingCosts = targetPrice * 0.03;
  const reservesNeeded = pitiMid * 2;
  const totalCash = downPayment + closingCosts + reservesNeeded;
  const cashGap = Math.max(0, totalCash - (profile.savings || 0) - dpaAmount);
  const weeklySurplus = ((profile.income_net || 0) - (profile.rent || 0) - (profile.debts_min || 0)) / 4.33;
  const cashWeeks = cashGap > 0 ? Math.ceil(cashGap / Math.max(weeklySurplus, 100)) : 0;
  
  const creditWeeks = (profile.credit_score || 0) >= CREDIT_THRESHOLD ? 0 : 6;
  const packetWeeks = Math.ceil((100 - packetCompleteness) / 10);
  
  const eta_weeks = Math.max(cashWeeks, creditWeeks, packetWeeks);
  
  return {
    score,
    piti_low: piti.low,
    piti_high: piti.high,
    eta_weeks,
    affordability_fit: affordability,
    credit_band_points: credit,
    reserves_months: (profile.savings || 0) / pitiMid,
    pkt_points: packet,
    breakdown: {
      affordability: { score: affordability, weight: 40 },
      credit: { score: credit, weight: 25 },
      reserves: { score: reserves, weight: 20 },
      packet: { score: packet, weight: 15 },
    },
  };
}

export function generateTimeline(etaWeeks: number): Array<{
  id: string;
  title: string;
  weeks: number;
  status: "completed" | "current" | "upcoming";
}> {
  const now = new Date();
  const milestones = [
    { id: "budget", title: "Budget Set", weeks: 0 },
    { id: "dpa", title: "DPA Pre-Check", weeks: 1 },
    { id: "docs", title: "Docs 80%", weeks: Math.min(3, Math.floor(etaWeeks * 0.3)) },
    { id: "credit", title: "Credit Tune-Up", weeks: Math.min(6, Math.floor(etaWeeks * 0.5)) },
    { id: "packet", title: "Lender-Ready Packet", weeks: Math.floor(etaWeeks * 0.8) },
    { id: "preapproval", title: "Pre-Approval Window", weeks: etaWeeks },
    { id: "appraisal", title: "Appraisal Prep", weeks: etaWeeks + 2 },
  ];
  
  return milestones.map((m, i) => ({
    ...m,
    status: i === 0 ? "completed" : i === 1 ? "current" : "upcoming",
  }));
}
