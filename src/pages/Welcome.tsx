import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  MessageCircle,
  FileCheck,
  TrendingUp,
  Heart,
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import homeReadyLogo from "@/assets/homeready-logo.png";
import familyHomeDream from "@/assets/family-home-dream.webp";
import familyOutdoor from "@/assets/family-outdoor.jpg";
import coupleHappy from "@/assets/couple-happy.webp";

export default function Welcome() {
  return (
    <>
      <Navigation></Navigation>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-8 md:py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
            {/* Logo and Branding */}
            <div className="space-y-4 md:space-y-6">
              <img
                src={homeReadyLogo}
                alt="HomeReady Logo"
                className="mx-auto h-28 md:h-40 lg:h-48 w-auto" // increased sizes
              />
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground text-center px-6 leading-snug">
                One conversation. One packet. One HomeReady.
              </h2>
            </div>

            {/* Mission Statement */}
            <Card className="p-5 md:p-8 bg-card/50 backdrop-blur border-accent/20">
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-xl font-semibold text-foreground flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Heart className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  <span className="text-center">
                    Building Generational Wealth Through Homeownership
                  </span>
                </h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed px-2">
                  We understand that homeownership is more than just buying a
                  house—it's about creating stability, building wealth for your
                  family, and investing in your community. Whether you're the
                  first in your family to buy or continuing a legacy, we're here
                  to guide you every step of the way.
                </p>
              </div>
            </Card>

            {/* Key Features */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-12 px-2">
              <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-shadow">
                <MessageCircle className="h-8 w-8 md:h-10 md:w-10 text-primary mx-auto mb-3 md:mb-4" />
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
                  Personalized Guidance
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  One-on-one support tailored to your unique journey,
                  acknowledging your goals and challenges.
                </p>
              </Card>

              <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-shadow">
                <TrendingUp className="h-8 w-8 md:h-10 md:w-10 text-primary mx-auto mb-3 md:mb-4" />
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
                  Down Payment Assistance
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Discover programs designed to help you overcome the biggest
                  barrier to homeownership.
                </p>
              </Card>

              <Card className="p-4 md:p-6 bg-card hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1">
                <FileCheck className="h-8 w-8 md:h-10 md:w-10 text-primary mx-auto mb-3 md:mb-4" />
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
                  Lender-Ready Packet
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  We help you organize everything you need, making the process
                  clear and stress-free.
                </p>
              </Card>
            </div>

            {/* Privacy Assurance */}
            <Card className="p-4 md:p-6 bg-accent/10 border-accent mx-2">
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Shield className="h-5 w-5 md:h-6 md:w-6 text-accent shrink-0 mt-0.5" />
                <div className="text-left w-full">
                  <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
                    Your Privacy & Trust Matter
                  </h3>
                  <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                    <li>✓ All data encrypted and secure</li>
                    <li>✓ No credit pulls without your permission</li>
                    <li>✓ You control your data—download or delete anytime</li>
                    <li>
                      ✓ Community partnership, not corporate data extraction
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* CTA */}
            <div className="pt-6 md:pt-8 px-4">
              <Link to="/dashboard">
                <Button
                  size="lg"
                  className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 shadow-lg hover:scale-105 transition-transform"
                >
                  Begin Your Journey
                </Button>
              </Link>
              <p className="text-xs md:text-sm text-muted-foreground mt-3 md:mt-4">
                Join thousands of families building their future through
                homeownership
              </p>
            </div>
          </div>
        </div>

        {/* Why Homeownership Matters */}
        <div className="bg-muted/50 py-8 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
              <h2 className="text-xl md:text-2xl font-bold text-center text-foreground mb-6 md:mb-8 px-4">
                Why Homeownership Matters
              </h2>

              {/* Image Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <img
                  src={familyHomeDream}
                  alt="Happy Black family achieving their homeownership dreams"
                  className="rounded-xl shadow-md w-full object-cover aspect-video"
                />
                <img
                  src={familyOutdoor}
                  alt="Black family celebrating homeownership outdoors"
                  className="rounded-xl shadow-md w-full object-cover aspect-video"
                />
                <img
                  src={coupleHappy}
                  alt="Happy Black couple excited about their home journey"
                  className="rounded-xl shadow-md w-full object-cover aspect-video"
                />
              </div>

              <Card className="p-4 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 md:mb-3">
                  Building Generational Wealth
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Homeownership is one of the most powerful tools for building
                  wealth and passing it down to future generations. Your home
                  becomes an asset that appreciates over time.
                </p>
              </Card>

              <Card className="p-4 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 md:mb-3">
                  Stability for Your Family
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Owning your home provides stability—no more rent increases, no
                  landlord decisions. You create a secure foundation for your
                  family's future.
                </p>
              </Card>

              <Card className="p-4 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 md:mb-3">
                  Pride of Ownership
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  There's a unique sense of accomplishment and pride that comes
                  with owning your home. It's yours to personalize, improve, and
                  call your own.
                </p>
              </Card>

              <Card className="p-4 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 md:mb-3">
                  Community Investment
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Homeownership strengthens communities. When families own their
                  homes, they invest in their neighborhoods, creating lasting
                  positive impact.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
