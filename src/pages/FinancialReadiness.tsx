import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, PiggyBank, Calculator } from "lucide-react";

const assessmentAreas = [
  {
    icon: DollarSign,
    title: "Income Assessment",
    description: "Evaluate your monthly income and employment stability",
  },
  {
    icon: TrendingUp,
    title: "Credit Health",
    description: "Review your credit score and payment history",
  },
  {
    icon: PiggyBank,
    title: "Savings & Reserves",
    description: "Calculate your available funds for down payment and closing costs",
  },
  {
    icon: Calculator,
    title: "Debt-to-Income Ratio",
    description: "Understand how your debts compare to your income",
  },
];

export default function FinancialReadiness() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">Financial Readiness Assessment</h1>
            <p className="text-lg text-muted-foreground">
              Understand where you stand financially and what steps to take to become mortgage-ready.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {assessmentAreas.map((area, index) => {
              const Icon = area.icon;
              return (
                <Card key={index} className="p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{area.title}</h3>
                      <p className="text-muted-foreground">{area.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-8 bg-accent/10 border-accent">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-4">
              Use our interactive chat to get a personalized financial readiness assessment and timeline.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
