import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CreditTuneUpCardProps {
  currentScore: number;
  onComplete: () => void;
}

interface TuneUpTask {
  id: string;
  title: string;
  description: string;
  impact: string;
  completed: boolean;
}

export function CreditTuneUpCard({ currentScore, onComplete }: CreditTuneUpCardProps) {
  const [tasks, setTasks] = useState<TuneUpTask[]>([
    {
      id: "1",
      title: "Review Credit Report",
      description: "Check for errors or discrepancies",
      impact: "+10-20 points",
      completed: false,
    },
    {
      id: "2",
      title: "Pay Down High Balances",
      description: "Reduce credit utilization below 30%",
      impact: "+15-40 points",
      completed: false,
    },
    {
      id: "3",
      title: "Set Up Payment Reminders",
      description: "Never miss a payment",
      impact: "+20-50 points",
      completed: false,
    },
    {
      id: "4",
      title: "Dispute Errors",
      description: "Contest any inaccuracies found",
      impact: "+10-30 points",
      completed: false,
    },
  ]);

  const handleToggleTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
    toast.success("Task updated!");
  };

  const completedCount = tasks.filter(task => task.completed).length;
  const isAllComplete = completedCount === tasks.length;
  const potentialScore = currentScore + (completedCount * 15);

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Credit Tune-Up</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete these tasks to improve your credit score and lending terms.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Current Score</p>
          <p className="text-2xl font-bold text-foreground">{currentScore}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Potential Score</p>
          <p className="text-2xl font-bold text-primary">{potentialScore}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              task.completed
                ? "border-success bg-success/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => handleToggleTask(task.id)}
          >
            {task.completed ? (
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={`font-medium ${task.completed ? "text-success" : "text-foreground"}`}>
                  {task.title}
                </p>
                <span className="text-xs font-medium text-primary shrink-0">
                  {task.impact}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">
            {completedCount}/{tasks.length} tasks
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
          />
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!isAllComplete}
        onClick={onComplete}
      >
        Continue to Lender Packet
      </Button>
    </Card>
  );
}
