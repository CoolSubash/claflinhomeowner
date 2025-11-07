import { ReadinessScore } from "@/types/homebuyer";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReadinessCardProps {
  readiness: ReadinessScore;
}

export function ReadinessCard({ readiness }: ReadinessCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-success";
    if (score >= 50) return "text-primary";
    return "text-destructive";
  };

  const getProgressColor = (score: number) => {
    if (score >= 75) return "bg-success";
    if (score >= 50) return "bg-primary";
    return "bg-destructive";
  };

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">Readiness Score</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-5 w-5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Your readiness score shows how prepared you are to buy a home. It's calculated from
                affordability (40%), credit (25%), reserves (20%), and packet completeness (15%).
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-5xl font-bold ${getScoreColor(readiness.score)}`}>
            {readiness.score}
          </span>
          <span className="text-2xl text-muted-foreground">/100</span>
        </div>
        <Progress value={readiness.score} className="h-3" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Affordability Fit</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    How well your payment fits within 28-38% of your net income
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="font-semibold text-foreground">
            {readiness.breakdown.affordability.score}/100
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Credit Band</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Credit score strength (target: 640+)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="font-semibold text-foreground">
            {readiness.breakdown.credit.score}/100
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Reserves</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Months of PITI you have saved (target: 2+ months)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="font-semibold text-foreground">
            {readiness.breakdown.reserves.score}/100
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Packet Completeness</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Percentage of required documents submitted</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="font-semibold text-foreground">
            {readiness.breakdown.packet.score}/100
          </span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">Payment Range (PITI)</span>
          <span className="text-lg font-semibold text-primary">
            ${readiness.piti_low.toLocaleString()} - ${readiness.piti_high.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Readiness Feedback Section */}
      {readiness.score < 100 && (
        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-2">You're Not Quite Ready Yet</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Don't worry! Here's what you need to work on to reach 100% readiness:
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Affordability Feedback */}
            {readiness.breakdown.affordability.score < 80 && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                <h5 className="font-medium text-sm text-foreground mb-1">💰 Improve Affordability</h5>
                <p className="text-xs text-muted-foreground mb-2">
                  Your monthly payment is stretching your budget. Consider:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Looking at homes in a lower price range</li>
                  <li>Increasing your income through a side job or raise</li>
                  <li>Reducing your monthly debts before buying</li>
                  <li>Finding a larger down payment to lower monthly payments</li>
                </ul>
              </div>
            )}

            {/* Credit Feedback */}
            {readiness.breakdown.credit.score < 80 && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                <h5 className="font-medium text-sm text-foreground mb-1">📊 Boost Your Credit Score</h5>
                <p className="text-xs text-muted-foreground mb-2">
                  A higher credit score will help you qualify. Try:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Pay down credit card balances below 30% utilization</li>
                  <li>Make all payments on time for the next 3-6 months</li>
                  <li>Don't open new credit accounts right now</li>
                  <li>Check your credit report for errors at AnnualCreditReport.com</li>
                  <li>Consider becoming an authorized user on a family member's card</li>
                </ul>
              </div>
            )}

            {/* Reserves Feedback */}
            {readiness.breakdown.reserves.score < 80 && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                <h5 className="font-medium text-sm text-foreground mb-1">💵 Build Your Reserves</h5>
                <p className="text-xs text-muted-foreground mb-2">
                  You need more savings for emergencies. Aim for at least 2 months of PITI:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Save ${Math.round((readiness.piti_low + readiness.piti_high) / 2 * 2).toLocaleString()} for 2 months reserves</li>
                  <li>Set up automatic transfers to your savings</li>
                  <li>Apply for down payment assistance programs</li>
                  <li>Consider gifts from family members (properly documented)</li>
                  <li>Reduce discretionary spending temporarily</li>
                </ul>
              </div>
            )}

            {/* Packet Feedback */}
            {readiness.breakdown.packet.score < 80 && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                <h5 className="font-medium text-sm text-foreground mb-1">📄 Complete Your Packet</h5>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload all required documents to move forward:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Upload pay stubs from the last 2 months</li>
                  <li>Provide 2 years of W-2s or tax returns</li>
                  <li>Submit recent bank statements (2 months)</li>
                  <li>Include ID and Social Security card copies</li>
                </ul>
              </div>
            )}
          </div>

          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-foreground font-medium mb-1">💪 You Can Do This!</p>
            <p className="text-xs text-muted-foreground">
              Every step you take gets you closer to homeownership. Focus on one area at a time, 
              and your readiness score will improve. We're here to help you every step of the way!
            </p>
          </div>
        </div>
      )}

      {/* Ready Message */}
      {readiness.score === 100 && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="p-4 bg-success/10 rounded-lg border border-success/20 text-center">
            <h4 className="font-semibold text-success mb-1">🎉 You're Ready!</h4>
            <p className="text-sm text-muted-foreground">
              Congratulations! Your readiness score is perfect. You're prepared to purchase a home!
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
