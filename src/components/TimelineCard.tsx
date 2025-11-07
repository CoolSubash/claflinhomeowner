import { Card } from "@/components/ui/card";
import { Check, Circle, Clock } from "lucide-react";
import { addWeeks, format } from "date-fns";

interface TimelineMilestone {
  id: string;
  title: string;
  weeks: number;
  status: "completed" | "current" | "upcoming";
}

interface TimelineCardProps {
  etaWeeks: number;
  milestones: TimelineMilestone[];
  completedPhases?: Set<string>;
}

export function TimelineCard({ etaWeeks, milestones, completedPhases = new Set() }: TimelineCardProps) {
  const today = new Date();
  const targetDate = addWeeks(today, etaWeeks);

  // Map phase completion to milestone IDs
  const getMilestoneStatus = (milestoneId: string): "completed" | "current" | "upcoming" => {
    const phaseMap: Record<string, string> = {
      "docs": "documents",
      "credit": "credit",
      "packet": "packet",
      "preapproval": "preapproval",
      "appraisal": "appraisal",
    };

    const phase = phaseMap[milestoneId];
    if (phase && completedPhases.has(phase)) {
      return "completed";
    }

    // Keep original status for budget and dpa
    if (milestoneId === "budget") return "completed";
    if (milestoneId === "dpa") return completedPhases.size > 0 ? "completed" : "current";

    // Determine current step
    if (phase) {
      const phaseOrder = ["documents", "credit", "packet", "preapproval", "appraisal"];
      const phaseIndex = phaseOrder.indexOf(phase);
      const completedIndices = Array.from(completedPhases)
        .map(p => phaseOrder.indexOf(p))
        .filter(i => i >= 0);
      const maxCompleted = Math.max(-1, ...completedIndices);
      
      if (phaseIndex === maxCompleted + 1) return "current";
    }

    return "upcoming";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-success">
            <Check className="h-3 w-3 text-white" />
          </div>
        );
      case "current":
        return <Circle className="h-5 w-5 text-primary fill-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-foreground mb-2">Your Timeline</h3>
        <div className="flex items-baseline gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="text-2xl font-bold text-primary">{etaWeeks} weeks</span>
          <span className="text-sm text-muted-foreground">
            (± 2 weeks) · Target: {format(targetDate, "MMM d, yyyy")}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, idx) => {
          const milestoneDate = addWeeks(today, milestone.weeks);
          const status = getMilestoneStatus(milestone.id);
          return (
            <div key={milestone.id} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                {getStatusIcon(status)}
                {idx < milestones.length - 1 && (
                  <div className="w-0.5 h-12 bg-border mt-2" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <h4 className={`font-semibold ${status === "completed" ? "text-success" : status === "current" ? "text-primary" : "text-muted-foreground"}`}>
                    {milestone.title}
                  </h4>
                  <span className="text-sm text-muted-foreground">
                    {format(milestoneDate, "MMM d")}
                  </span>
                </div>
                {status === "completed" && (
                  <p className="text-sm text-success mt-1">
                    ✓ Complete
                  </p>
                )}
                {status === "current" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    In progress - keep going!
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          This timeline is based on your current readiness and assumes steady progress. Your actual
          timeline may vary.
        </p>
      </div>
    </Card>
  );
}
