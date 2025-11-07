import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileCheck, CheckCircle2, Circle, Download, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FindLenderDialog } from "./FindLenderDialog";

interface LenderPacketCardProps {
  userProfile: {
    income_net?: number;
    credit_score?: number;
    savings?: number;
    city_zip?: string;
  };
  onComplete: () => void;
}

interface PacketItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export function LenderPacketCard({ userProfile, onComplete }: LenderPacketCardProps) {
  const [lenderDialogOpen, setLenderDialogOpen] = useState(false);
  const [items, setItems] = useState<PacketItem[]>([
    {
      id: "1",
      title: "Financial Summary",
      description: "Income, assets, and liabilities overview",
      completed: false,
    },
    {
      id: "2",
      title: "Document Package",
      description: "All uploaded documents organized",
      completed: false,
    },
    {
      id: "3",
      title: "Pre-qualification Letter",
      description: "Ready for lender review",
      completed: false,
    },
    {
      id: "4",
      title: "DPA Application",
      description: "Down payment assistance forms",
      completed: false,
    },
  ]);

  const handleToggleItem = (itemId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
    toast.success("Item updated!");
  };

  const completedCount = items.filter(item => item.completed).length;
  const isAllComplete = completedCount === items.length;

  const handleDownloadPacket = () => {
    // Generate packet data
    const packetData = {
      applicant: {
        income: userProfile.income_net,
        creditScore: userProfile.credit_score,
        savings: userProfile.savings,
      },
      documents: items.filter(item => item.completed).map(item => item.title),
      generatedAt: new Date().toISOString(),
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(packetData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lender-packet-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Lender packet downloaded!");
  };

  return (
    <>
      <FindLenderDialog
        open={lenderDialogOpen}
        onOpenChange={setLenderDialogOpen}
        userProfile={userProfile}
      />
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileCheck className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Lender-Ready Packet</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Prepare your complete packet for lender submission.
        </p>
      </div>

      <div className="p-4 bg-muted/30 rounded-lg mb-6">
        <p className="text-sm font-medium text-foreground mb-3">Your Profile Summary</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Monthly Income</p>
            <p className="text-sm font-semibold text-foreground">
              ${userProfile.income_net?.toLocaleString() || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Credit Score</p>
            <p className="text-sm font-semibold text-foreground">
              {userProfile.credit_score || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Savings</p>
            <p className="text-sm font-semibold text-foreground">
              ${userProfile.savings?.toLocaleString() || "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              item.completed
                ? "border-success bg-success/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => handleToggleItem(item.id)}
          >
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${item.completed ? "text-success" : "text-foreground"}`}>
                {item.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Packet Completion</span>
          <span className="font-medium text-foreground">
            {completedCount}/{items.length} items
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {isAllComplete && (
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={handleDownloadPacket}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Packet
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={() => setLenderDialogOpen(true)}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Find a Lender
          </Button>
        </div>
      )}

      <Button
        className="w-full mt-3"
        size="lg"
        disabled={!isAllComplete}
        onClick={onComplete}
      >
        Continue to Pre-Approval
      </Button>
    </Card>
    </>
  );
}
