import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Star, MapPin, Phone, Mail, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FindLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: {
    income_net?: number;
    credit_score?: number;
    savings?: number;
    city_zip?: string;
  };
}

interface Lender {
  id: string;
  name: string;
  type: string;
  rating: number;
  specialties: string[];
  location: string;
  phone: string;
  email: string;
  whyMatch: string;
}

export function FindLenderDialog({ open, onOpenChange, userProfile }: FindLenderDialogProps) {
  // Generate recommended lenders based on user profile
  const getLenders = (): Lender[] => {
    const creditScore = userProfile.credit_score || 650;
    const lenders: Lender[] = [];

    // Recommend based on credit score and profile
    if (creditScore >= 700) {
      lenders.push({
        id: "1",
        name: "Prime Mortgage Solutions",
        type: "Mortgage Broker",
        rating: 4.8,
        specialties: ["First-Time Buyers", "Conventional Loans", "FHA"],
        location: userProfile.city_zip || "Your Area",
        phone: "(555) 123-4567",
        email: "info@primemortgage.com",
        whyMatch: "Excellent rates for your strong credit profile",
      });
    }

    lenders.push({
      id: "2",
      name: "Community First Lending",
      type: "Credit Union",
      rating: 4.7,
      specialties: ["Down Payment Assistance", "First-Time Buyers", "FHA/VA"],
      location: userProfile.city_zip || "Your Area",
      phone: "(555) 234-5678",
      email: "loans@communityfirst.com",
      whyMatch: "Specialized in DPA programs that match your profile",
    });

    if (creditScore < 700) {
      lenders.push({
        id: "3",
        name: "Second Chance Home Loans",
        type: "Local Bank",
        rating: 4.5,
        specialties: ["Credit Building", "FHA", "USDA"],
        location: userProfile.city_zip || "Your Area",
        phone: "(555) 345-6789",
        email: "apply@secondchance.com",
        whyMatch: "Works with borrowers building their credit",
      });
    }

    lenders.push({
      id: "4",
      name: "HomePath Financial",
      type: "Online Lender",
      rating: 4.6,
      specialties: ["Quick Approval", "First-Time Buyers", "Conventional"],
      location: "Nationwide",
      phone: "(555) 456-7890",
      email: "support@homepath.com",
      whyMatch: "Fast digital process with competitive rates",
    });

    return lenders;
  };

  const lenders = getLenders();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Recommended Lenders for You</DialogTitle>
          <DialogDescription>
            Based on your profile, here are lenders that match your needs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {lenders.map((lender) => (
            <Card key={lender.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">{lender.name}</h4>
                      <p className="text-sm text-muted-foreground">{lender.type}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="text-sm font-medium">{lender.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {lender.specialties.map((specialty) => (
                      <Badge key={specialty} variant="secondary" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>

                  <div className="p-3 bg-success/5 border border-success/20 rounded-lg mb-3">
                    <p className="text-sm font-medium text-success">
                      ✓ {lender.whyMatch}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{lender.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{lender.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">{lender.email}</span>
                    </div>
                  </div>

                  <Button className="w-full" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Contact Lender
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> These are recommended lenders based on your profile. 
            We encourage you to compare rates, terms, and services from multiple lenders before making your decision.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
