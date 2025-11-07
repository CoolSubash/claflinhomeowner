import { DPAProgram } from "@/types/homebuyer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, DollarSign, Clock } from "lucide-react";

interface DPAMatchCardProps {
  program: DPAProgram;
}

export function DPAMatchCard({ program }: DPAMatchCardProps) {
  return (
    <Card className="p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground pr-4">{program.name}</h3>
        <div className="flex items-baseline gap-1 text-primary shrink-0">
          <DollarSign className="h-4 w-4" />
          <span className="text-xl font-bold">{program.est_amount.toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-1">Why You Likely Qualify</h4>
          <p className="text-sm text-muted-foreground">{program.why_qualify}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">What You'll Need</h4>
          <ul className="space-y-1">
            {program.requirements.map((req, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{program.timing}</span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full mt-4"
        onClick={() => window.open(program.url, "_blank")}
      >
        Learn More
        <ExternalLink className="ml-2 h-4 w-4" />
      </Button>
    </Card>
  );
}
