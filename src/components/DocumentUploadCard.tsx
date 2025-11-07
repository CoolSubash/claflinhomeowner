import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { DocumentItem } from "@/types/homebuyer";
import { useState } from "react";
import { toast } from "sonner";

interface DocumentUploadCardProps {
  documents: DocumentItem[];
  onDocumentUpload: (type: string) => void;
  onComplete: () => void;
}

const REQUIRED_DOCUMENTS = [
  { type: "ID Document", description: "Driver's license or passport" },
  { type: "Income Verification", description: "Last 2 pay stubs or W2" },
  { type: "Bank Statements", description: "Last 2-3 months" },
  { type: "Credit Report", description: "Recent credit report (optional)" },
];

export function DocumentUploadCard({ documents, onDocumentUpload, onComplete }: DocumentUploadCardProps) {
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const getDocumentStatus = (type: string): DocumentItem | undefined => {
    return documents.find(doc => doc.type === type);
  };

  const handleUpload = (type: string) => {
    setUploadingType(type);
    // Simulate upload delay
    setTimeout(() => {
      onDocumentUpload(type);
      setUploadingType(null);
      toast.success(`${type} uploaded successfully!`);
    }, 1000);
  };

  const completedCount = REQUIRED_DOCUMENTS.filter(doc => 
    getDocumentStatus(doc.type)?.status === "verified"
  ).length;

  const isAllComplete = completedCount === REQUIRED_DOCUMENTS.length;

  return (
    <Card className="p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-foreground">Document Upload</h3>
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{REQUIRED_DOCUMENTS.length} Complete
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload your documents to move forward with your homebuying journey.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const status = getDocumentStatus(doc.type);
          const isVerified = status?.status === "verified";
          const isUploading = uploadingType === doc.type;

          return (
            <div
              key={doc.type}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                {isVerified ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-foreground">{doc.type}</p>
                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                </div>
              </div>
              {!isVerified && (
                <Button
                  size="sm"
                  onClick={() => handleUpload(doc.type)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    "Uploading..."
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              )}
              {isVerified && (
                <span className="text-sm font-medium text-success">Verified</span>
              )}
            </div>
          );
        })}
      </div>

      {isAllComplete ? (
        <div className="flex items-center gap-3 p-4 bg-success/10 border border-success rounded-lg mb-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-sm font-medium text-success">All documents uploaded!</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg mb-4">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Upload all required documents to proceed to the next step.
          </p>
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!isAllComplete}
        onClick={onComplete}
      >
        Continue to Credit Tune-Up
      </Button>
    </Card>
  );
}
