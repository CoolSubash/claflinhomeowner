import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { ReadinessCard } from "@/components/ReadinessCard";
import { TimelineCard } from "@/components/TimelineCard";
import { DPAMatchCard } from "@/components/DPAMatchCard";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { CreditTuneUpCard } from "@/components/CreditTuneUpCard";
import { LenderPacketCard } from "@/components/LenderPacketCard";
import { PreApprovalCard } from "@/components/PreApprovalCard";
import { AppraisalPrepCard } from "@/components/AppraisalPrepCard";
import { CompletionSurveyCard } from "@/components/CompletionSurveyCard";
import { ChatMessage, ReadinessScore, UserProfile, DocumentItem } from "@/types/homebuyer";
import { NC_DPA_PROGRAMS } from "@/data/seedData";
import { calculateReadinessScore, generateTimeline } from "@/utils/calculations";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, FileText, MessageCircle, CheckCircle2, Trophy, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Phase = "initial" | "readiness" | "documents" | "credit" | "packet" | "preapproval" | "appraisal" | "survey" | "complete";

export default function HomeCoach() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [chatOpen, setChatOpen] = useState(true); // Open by default on first visit
  const [userProfile, setUserProfile] = useState<Partial<UserProfile>>({});
  const [currentPhase, setCurrentPhase] = useState<Phase>("initial");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initialize with welcome message
    const welcomeMessage: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: `Hi, I'm Haven—your path to keys starts here.

I'm here to guide you from curiosity to homeownership, one conversation at a time.

I'll help you:
• Understand what you can afford
• Find down payment assistance programs
• Organize your documents
• Get lender-ready

Before we begin, let me share how we protect your information:
✓ We only collect what's needed for your homebuying plan
✓ No live credit pulls - we work with what you share
✓ You can download or delete your data anytime
✓ We explain the rules but don't make lending decisions

Ready to get started? Let's talk about your goals!`,
      timestamp: new Date().toISOString(),
      step: 0,
    };

    setMessages([welcomeMessage]);
    // Removed demo data - readiness will be calculated based on user input
  }, []);

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Simulate assistant response based on conversation flow
    setTimeout(() => {
      const assistantMessage = generateResponse(content, currentStep);
      setMessages((prev) => [...prev, assistantMessage]);
      
      if (assistantMessage.step !== undefined) {
        setCurrentStep(assistantMessage.step);
      }
    }, 1000);
  };

  const generateResponse = (userInput: string, step: number): ChatMessage => {
    let response: { content: string; step: number } = { content: "", step };
    const input = userInput.toLowerCase();

    switch (step) {
      case 0: // After welcome, ask for location
        response = {
          content: `Great! Let's start by understanding your situation. Where are you looking to buy? (Just tell me the city or zip code)`,
          step: 1,
        };
        break;

      case 1: // After location, ask for income
        // Extract zip code if provided
        const zipMatch = userInput.match(/\b\d{5}\b/);
        const hasLocation = zipMatch || userInput.trim().length > 2;
        
        if (!hasLocation) {
          response = {
            content: `I need a valid location to continue. Please provide either a city name or a 5-digit zip code. For example: "Raleigh" or "27610"`,
            step: 1, // Stay on same step
          };
        } else {
          if (zipMatch) {
            setUserProfile(prev => ({ ...prev, city_zip: zipMatch[0] }));
          }
          response = {
            content: `Perfect! Now let's talk about your budget. What's your monthly take-home income after taxes? (Just the number is fine, like 4500)`,
            step: 2,
          };
        }
        break;

      case 2: // After income, ask for monthly debts
        const incomeMatch = userInput.match(/(\d+,?\d*)/);
        if (!incomeMatch || parseFloat(incomeMatch[1].replace(/,/g, '')) <= 0) {
          response = {
            content: `I need a valid monthly income amount. Please enter just the number, like "4500" or "5,200". This should be your monthly take-home pay after taxes.`,
            step: 2, // Stay on same step
          };
        } else {
          const income = parseFloat(incomeMatch[1].replace(/,/g, ''));
          setUserProfile(prev => ({ ...prev, income_net: income }));
          response = {
            content: `Thanks! Now, what are your total monthly debt payments? Include:
• Credit card minimums
• Student loans
• Car payments
• Any other loans

Just give me the total monthly amount. Enter "0" if you don't have any monthly debts.`,
            step: 3,
          };
        }
        break;

      case 3: // After debts, ask for credit score
        const debtMatch = userInput.match(/(\d+,?\d*)/);
        if (!debtMatch) {
          response = {
            content: `I need a valid amount for your monthly debts. Please enter just the number, like "800" or "1,200". If you don't have any debts, enter "0".`,
            step: 3, // Stay on same step
          };
        } else {
          const debt = parseFloat(debtMatch[1].replace(/,/g, ''));
          setUserProfile(prev => ({ ...prev, debts_min: debt }));
          response = {
            content: `Got it. Do you know your credit score? If not, just give me your best estimate (like 650). Don't worry - we won't pull your credit!`,
            step: 4,
          };
        }
        break;

      case 4: // After credit, ask for savings
        const creditMatch = userInput.match(/(\d+)/);
        const creditScore = creditMatch ? parseInt(creditMatch[1]) : 0;
        
        if (!creditMatch || creditScore < 300 || creditScore > 850) {
          response = {
            content: `Please provide a valid credit score between 300 and 850. If you're not sure, a typical estimate would be something like 650 or 700. What's your best guess?`,
            step: 4, // Stay on same step
          };
        } else {
          setUserProfile(prev => ({ ...prev, credit_score: creditScore }));
          response = {
            content: `Great! How much do you have saved for a down payment and closing costs? (Again, just the number)`,
            step: 5,
          };
        }
        break;

      case 5: // After savings, ask for target price
        const savingsMatch = userInput.match(/(\d+,?\d*)/);
        if (!savingsMatch) {
          response = {
            content: `I need a valid savings amount. Please enter just the number, like "5000" or "10,000". If you don't have savings yet, enter "0".`,
            step: 5, // Stay on same step
          };
        } else {
          const savings = parseFloat(savingsMatch[1].replace(/,/g, ''));
          setUserProfile(prev => ({ ...prev, savings }));
          response = {
            content: `Excellent! Last question: What's your target home price? What are you hoping to buy? (If you're not sure, just say "not sure" and I'll help you figure it out)`,
            step: 6,
          };
        }
        break;

      case 6: // Calculate and show results
        let targetPrice = 0;
        const priceMatch = userInput.match(/(\d+,?\d*)/);
        if (priceMatch) {
          targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        } else if (userInput.toLowerCase().includes("not sure") || userInput.toLowerCase().includes("don't know")) {
          // If user is unsure, calculate based on their income
          const affordableMonthly = (userProfile.income_net || 4000) * 0.28;
          // Work backwards from PITI to home price (rough estimate)
          targetPrice = affordableMonthly * 150; // Rough multiplier based on typical rates
        }
        
        // Calculate readiness with collected data
        const profile: UserProfile = {
          id: "temp",
          email: "temp@example.com",
          role: "User",
          income_net: userProfile.income_net || 4000,
          debts_min: userProfile.debts_min || 500,
          credit_score: userProfile.credit_score || 650,
          savings: userProfile.savings || 5000,
          target_price_min: targetPrice || 200000,
          target_price_max: targetPrice || 200000,
          city_zip: userProfile.city_zip || "27610",
          rent: 0,
          dp_pct: 3,
          created_at: new Date().toISOString(),
        };
        
        setUserProfile(profile);
        const calculatedReadiness = calculateReadinessScore(profile, 0, 0);
        setReadiness(calculatedReadiness);
        setCurrentPhase("readiness");

        response = {
          content: `Perfect! I've analyzed your information and created your personalized dashboard. 

You can see your readiness score, timeline, and down payment assistance programs on the main screen. 

Based on your financial profile:
• Your recommended payment range is $${calculatedReadiness.piti_low.toLocaleString()}-$${calculatedReadiness.piti_high.toLocaleString()}/month
• Your readiness score is ${calculatedReadiness.score}/100
• Estimated time to lender-ready: ${calculatedReadiness.eta_weeks} weeks

When you're ready, you can begin uploading your documents to move to the next phase of your journey!`,
          step: 7,
        };
        break;

      default:
        response = {
          content: `I'm here to help! You can ask me about:
• Understanding your affordability
• Down payment assistance programs
• What documents you'll need
• Steps to improve your readiness score
• Timeline expectations

What would you like to know?`,
          step: 7,
        };
    }

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
      step: response.step,
    };
  };

  const milestones = readiness ? generateTimeline(readiness.eta_weeks) : [];

  const handleDocumentUpload = (type: string) => {
    setDocuments(prev => {
      const existing = prev.find(doc => doc.type === type);
      let newDocs;
      if (existing) {
        newDocs = prev.map(doc =>
          doc.type === type ? { ...doc, status: "verified" as const } : doc
        );
      } else {
        newDocs = [...prev, { type, status: "verified" as const, uploaded_at: new Date().toISOString() }];
      }
      
      // Recalculate readiness with updated packet completeness
      if (userProfile && readiness) {
        const requiredDocs = 8; // Total required documents
        const packetCompleteness = (newDocs.length / requiredDocs) * 100;
        const updatedReadiness = calculateReadinessScore(
          userProfile as UserProfile,
          0,
          packetCompleteness
        );
        setReadiness(updatedReadiness);
      }
      
      return newDocs;
    });
  };

  const handleDocumentsComplete = () => {
    setCompletedPhases(prev => new Set(prev).add("documents"));
    setCurrentPhase("credit");
    updateReadinessScore("documents");
    toast.success("Great! Moving to credit tune-up phase.");
  };

  const handleCreditComplete = () => {
    setCompletedPhases(prev => new Set(prev).add("credit"));
    setCurrentPhase("packet");
    updateReadinessScore("credit");
    toast.success("Excellent! Time to prepare your lender packet.");
  };

  const handlePacketComplete = () => {
    setCompletedPhases(prev => new Set(prev).add("packet"));
    
    // Recalculate readiness with full packet completeness
    if (userProfile && readiness) {
      const updatedReadiness = calculateReadinessScore(
        userProfile as UserProfile,
        0,
        100 // Packet is now 100% complete
      );
      setReadiness(updatedReadiness);
    }
    
    setCurrentPhase("preapproval");
    updateReadinessScore("packet");
    toast.success("Amazing! Moving to pre-approval phase.");
  };

  const handlePreApprovalComplete = () => {
    setCompletedPhases(prev => new Set(prev).add("preapproval"));
    setCurrentPhase("appraisal");
    updateReadinessScore("preapproval");
    toast.success("Great work! Time for appraisal preparation.");
  };

  const handleAppraisalComplete = () => {
    setCompletedPhases(prev => new Set(prev).add("appraisal"));
    setCurrentPhase("survey");
    updateReadinessScore("appraisal");
    toast.success("🎉 All steps complete! You're ready to buy a home!");
  };

  const handleSurveyComplete = () => {
    setCurrentPhase("complete");
    toast.success("Thank you for your feedback!");
  };

  const updateReadinessScore = (completedPhase: string) => {
    if (!readiness) return;
    
    // Boost readiness score based on completed phase
    const boosts: Record<string, number> = {
      documents: 5,
      credit: 5,
      packet: 5,
      preapproval: 5,
      appraisal: 5,
    };
    
    const boost = boosts[completedPhase] || 0;
    const newScore = Math.min(100, readiness.score + boost);
    
    setReadiness({
      ...readiness,
      score: newScore,
      breakdown: {
        ...readiness.breakdown,
        packet: {
          ...readiness.breakdown.packet,
          score: Math.min(100, readiness.breakdown.packet.score + boost),
        },
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Dynamic Info Panel - Full Width */}
        <div className="h-full overflow-y-auto bg-muted/30 p-4 md:p-6">
          <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-6">
            {/* Welcome Card - Show when in initial phase */}
            {currentPhase === "initial" && (
              <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    Welcome to SafePlace! 👋
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground">
                    Let's start a conversation about your homebuying journey. 
                    Click the chat button to begin!
                  </p>
                  <div className="flex justify-center pt-4">
                    <Button 
                      size="lg" 
                      onClick={() => setChatOpen(true)}
                      className="text-base md:text-lg px-6 md:px-8"
                    >
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Start Chat
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Security Notice */}
            <Card className="p-4 bg-accent/10 border-accent">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">
                    Your Privacy Matters
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All data encrypted. No credit pulls. You're in control.
                  </p>
                </div>
              </div>
            </Card>

            {/* Progress Tracker - Show after readiness phase */}
            {currentPhase !== "initial" && currentPhase !== "readiness" && (
              <Card className="p-4 bg-muted/30 border-primary/20">
                <h3 className="text-sm font-semibold text-foreground mb-3">Your Journey Progress</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {completedPhases.has("documents") ? (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    ) : currentPhase === "documents" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${completedPhases.has("documents") ? "text-success" : currentPhase === "documents" ? "text-primary" : "text-muted-foreground"}`}>
                        Documents Upload
                      </span>
                    </div>
                    {completedPhases.has("documents") && (
                      <Badge variant="default" className="bg-success text-xs">
                        ✓ Done
                      </Badge>
                    )}
                    {currentPhase === "documents" && !completedPhases.has("documents") && (
                      <Badge variant="default" className="bg-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {completedPhases.has("credit") ? (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    ) : currentPhase === "credit" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${completedPhases.has("credit") ? "text-success" : currentPhase === "credit" ? "text-primary" : "text-muted-foreground"}`}>
                        Credit Tune-Up
                      </span>
                    </div>
                    {completedPhases.has("credit") && (
                      <Badge variant="default" className="bg-success text-xs">
                        ✓ Done
                      </Badge>
                    )}
                    {currentPhase === "credit" && !completedPhases.has("credit") && (
                      <Badge variant="default" className="bg-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {completedPhases.has("packet") ? (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    ) : currentPhase === "packet" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${completedPhases.has("packet") ? "text-success" : currentPhase === "packet" ? "text-primary" : "text-muted-foreground"}`}>
                        Lender Packet
                      </span>
                    </div>
                    {completedPhases.has("packet") && (
                      <Badge variant="default" className="bg-success text-xs">
                        ✓ Done
                      </Badge>
                    )}
                    {currentPhase === "packet" && !completedPhases.has("packet") && (
                      <Badge variant="default" className="bg-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {completedPhases.has("preapproval") ? (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    ) : currentPhase === "preapproval" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${completedPhases.has("preapproval") ? "text-success" : currentPhase === "preapproval" ? "text-primary" : "text-muted-foreground"}`}>
                        Pre-Approval
                      </span>
                    </div>
                    {completedPhases.has("preapproval") && (
                      <Badge variant="default" className="bg-success text-xs">
                        ✓ Done
                      </Badge>
                    )}
                    {currentPhase === "preapproval" && !completedPhases.has("preapproval") && (
                      <Badge variant="default" className="bg-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {completedPhases.has("appraisal") ? (
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    ) : currentPhase === "appraisal" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${completedPhases.has("appraisal") ? "text-success" : currentPhase === "appraisal" ? "text-primary" : "text-muted-foreground"}`}>
                        Appraisal Prep
                      </span>
                    </div>
                    {completedPhases.has("appraisal") && (
                      <Badge variant="default" className="bg-success text-xs">
                        ✓ Done
                      </Badge>
                    )}
                    {currentPhase === "appraisal" && !completedPhases.has("appraisal") && (
                      <Badge variant="default" className="bg-primary text-xs">
                        Active
                      </Badge>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-3 mt-2 border-t border-border">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Overall Progress</span>
                      <span>{Math.round((completedPhases.size / 5) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                        style={{ width: `${(completedPhases.size / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Readiness Dashboard Phase */}
            {currentPhase === "readiness" && readiness && (
              <>
                {/* Readiness Score */}
                <ReadinessCard readiness={readiness} />

                {/* Timeline */}
                <TimelineCard etaWeeks={readiness.eta_weeks} milestones={milestones} completedPhases={completedPhases} />

                {/* DPA Programs */}
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
                    Down Payment Assistance Programs
                  </h2>
                  <div className="space-y-4">
                    {NC_DPA_PROGRAMS.map((program) => (
                      <DPAMatchCard key={program.id} program={program} />
                    ))}
                  </div>
                </div>

                {/* Next Steps Card */}
                <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold text-foreground">Ready for Next Steps?</h3>
                    <p className="text-muted-foreground">
                      Start uploading your documents to move forward with your homebuying journey.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => setCurrentPhase("documents")}
                      className="mt-4"
                    >
                      Begin Document Upload
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* Document Upload Phase */}
            {currentPhase === "documents" && readiness && (
              <>
                <ReadinessCard readiness={readiness} />
                <DocumentUploadCard
                  documents={documents}
                  onDocumentUpload={handleDocumentUpload}
                  onComplete={handleDocumentsComplete}
                />
              </>
            )}

            {/* Credit Tune-Up Phase */}
            {currentPhase === "credit" && readiness && userProfile.credit_score && (
              <>
                <ReadinessCard readiness={readiness} />
                <CreditTuneUpCard
                  currentScore={userProfile.credit_score}
                  onComplete={handleCreditComplete}
                />
              </>
            )}

            {/* Lender Packet Phase */}
            {currentPhase === "packet" && readiness && (
              <>
                <ReadinessCard readiness={readiness} />
                <LenderPacketCard
                  userProfile={userProfile}
                  onComplete={handlePacketComplete}
                />
              </>
            )}

            {/* Pre-Approval Phase */}
            {currentPhase === "preapproval" && readiness && (
              <>
                <ReadinessCard readiness={readiness} />
                <PreApprovalCard onComplete={handlePreApprovalComplete} />
              </>
            )}

            {/* Appraisal Prep Phase */}
            {currentPhase === "appraisal" && readiness && (
              <>
                <ReadinessCard readiness={readiness} />
                <AppraisalPrepCard onComplete={handleAppraisalComplete} />
              </>
            )}

            {/* Survey Phase */}
            {currentPhase === "survey" && (
              <CompletionSurveyCard onSubmit={handleSurveyComplete} />
            )}

            {/* Completion Phase */}
            {currentPhase === "complete" && readiness && (
              <>
                {readiness.score === 100 ? (
                  <Card className="p-8 bg-gradient-to-br from-success/20 to-primary/20 border-success text-center">
                    <PartyPopper className="h-16 w-16 text-success mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-foreground mb-2">
                      You're Ready to Buy a Home! 🎉
                    </h2>
                    <p className="text-lg text-muted-foreground mb-6">
                      Congratulations! You've completed all the steps and are fully prepared for homeownership.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                      <div className="p-3 bg-background/50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-xs font-medium">Documents</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-xs font-medium">Credit Tune-Up</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-xs font-medium">Lender Packet</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-xs font-medium">Pre-Approval</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-xs font-medium">Appraisal Prep</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground mb-6">
                      Thank you for choosing SafePlace! We hope we've helped make your homebuying journey smoother. 
                      Feel free to share SafePlace with anyone looking to buy a home!
                    </p>
                  </Card>
                ) : (
                  <Card className="p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary">
                    <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Great Progress! 💪
                    </h2>
                    <p className="text-lg text-muted-foreground mb-6">
                      You've completed all the steps, but your readiness score shows you still need to work on a few things before you're fully ready to purchase a home.
                    </p>
                    
                    <div className="bg-background/50 rounded-lg p-6 mb-6 text-left">
                      <h3 className="font-semibold text-foreground mb-3">Your Current Score: {readiness.score}/100</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Here's what still needs attention to reach 100% readiness:
                      </p>
                      
                      <div className="space-y-4">
                        {readiness.breakdown.affordability.score < 100 && (
                          <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                            <h4 className="font-medium text-sm mb-2">💰 Affordability ({readiness.breakdown.affordability.score}/100)</h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              Your estimated monthly payment is too high for your current income. Consider:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                              <li>Looking at homes in a lower price range</li>
                              <li>Increasing your income through additional work or a raise</li>
                              <li>Paying down existing debts to improve your debt-to-income ratio</li>
                              <li>Saving for a larger down payment to reduce monthly payments</li>
                            </ul>
                          </div>
                        )}
                        
                        {readiness.breakdown.credit.score < 100 && (
                          <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                            <h4 className="font-medium text-sm mb-2">📊 Credit Score ({readiness.breakdown.credit.score}/100)</h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              Your credit score needs improvement. Target: 640+ for best rates. Try:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                              <li>Pay all bills on time for the next 3-6 months</li>
                              <li>Keep credit card balances below 30% of your limits</li>
                              <li>Don't open new credit accounts right now</li>
                              <li>Check your credit report for errors at <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">AnnualCreditReport.com</a></li>
                              <li>Consider credit counseling services if needed</li>
                            </ul>
                          </div>
                        )}
                        
                        {readiness.breakdown.reserves.score < 100 && (
                          <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                            <h4 className="font-medium text-sm mb-2">💵 Reserves ({readiness.breakdown.reserves.score}/100)</h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              You need more savings for emergencies. Target: 2+ months of housing payment. Options:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                              <li>Save approximately ${Math.round((readiness.piti_low + readiness.piti_high) / 2 * 2).toLocaleString()} for 2 months reserves</li>
                              <li>Set up automatic transfers to savings each payday</li>
                              <li>Explore down payment assistance programs (see DPA section)</li>
                              <li>Consider documented gift funds from family</li>
                              <li>Temporarily reduce discretionary spending</li>
                            </ul>
                          </div>
                        )}
                        
                        {readiness.breakdown.packet.score < 100 && (
                          <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                            <h4 className="font-medium text-sm mb-2">📄 Packet Completeness ({readiness.breakdown.packet.score}/100)</h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              Complete your document packet to move forward:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                              <li>Upload all required documents in the Documents section</li>
                              <li>Ensure all documents are recent (within 60 days)</li>
                              <li>Make sure documents are clear and legible</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-primary/10 rounded-lg p-4 border border-primary/20 mb-6">
                      <h3 className="font-semibold text-foreground mb-2">📚 Helpful Resources</h3>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• <strong>Credit Counseling:</strong> <a href="https://www.nfcc.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">National Foundation for Credit Counseling</a></li>
                        <li>• <strong>Financial Education:</strong> <a href="https://www.mymoney.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline">MyMoney.gov</a></li>
                        <li>• <strong>First-Time Buyer Programs:</strong> <a href="https://www.hud.gov/buying" target="_blank" rel="noopener noreferrer" className="text-primary underline">HUD Homebuyer Programs</a></li>
                        <li>• <strong>Down Payment Assistance:</strong> Check out the DPA programs we've matched for you</li>
                      </ul>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      💪 <strong>Don't give up!</strong> Work on these areas and your readiness score will improve. 
                      Feel free to reach out to chat with Haven anytime for personalized guidance!
                    </p>
                  </Card>
                )}

                <ReadinessCard readiness={readiness} />
                <TimelineCard etaWeeks={readiness.eta_weeks} milestones={milestones} completedPhases={completedPhases} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-[var(--shadow-elevated)] hover:scale-110 transition-transform z-50"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:w-[440px] md:w-[540px] p-0 flex flex-col">
          <SheetHeader className="px-4 md:px-6 py-3 md:py-4 border-b border-border">
            <SheetTitle className="text-left text-base md:text-lg">Haven - SafePlace Coach</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
