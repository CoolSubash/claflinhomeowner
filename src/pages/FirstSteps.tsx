import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

const steps = [
  {
    title: "Understand Your Budget",
    description: "Calculate what you can afford based on your income and debts",
    completed: false,
  },
  {
    title: "Check Your Credit",
    description: "Review your credit score and address any issues",
    completed: false,
  },
  {
    title: "Save for Down Payment",
    description: "Build savings or explore down payment assistance programs",
    completed: false,
  },
  {
    title: "Get Pre-Approved",
    description: "Obtain a mortgage pre-approval letter from a lender",
    completed: false,
  },
  {
    title: "Find Your Home",
    description: "Work with a realtor to find properties in your budget",
    completed: false,
  },
];

export default function FirstSteps() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">Your First Steps to Homeownership</h1>
            <p className="text-lg text-muted-foreground">
              A clear, step-by-step guide to help you navigate the homebuying journey with confidence.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <Card key={index} className="p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      Step {index + 1}: {step.title}
                    </h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
