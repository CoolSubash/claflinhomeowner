import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PreApprovalCardProps {
  onComplete: () => void;
}

interface PreApprovalTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export function PreApprovalCard({ onComplete }: PreApprovalCardProps) {
  const [tasks, setTasks] = useState<PreApprovalTask[]>([
    {
      id: "1",
      title: "Submit Pre-Approval Application",
      description: "Complete lender's pre-approval form",
      completed: false,
    },
    {
      id: "2",
      title: "Review Pre-Approval Letter",
      description: "Verify approval amount and conditions",
      completed: false,
    },
    {
      id: "3",
      title: "Understand Contingencies",
      description: "Review any conditions or requirements",
      completed: false,
    },
    {
      id: "4",
      title: "Confirm Rate Lock Options",
      description: "Understand rate lock timing and costs",
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

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Pre-Approval Process</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete these steps to get your pre-approval letter and start house hunting.
        </p>
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
              <p className={`font-medium ${task.completed ? "text-success" : "text-foreground"}`}>
                {task.title}
              </p>
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
        Continue to Appraisal Prep
      </Button>
    </Card>
  );
}
