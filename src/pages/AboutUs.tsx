import { Card } from "@/components/ui/card";
import { Heart, Target, Users, Shield } from "lucide-react";
import familyExpecting from "@/assets/family-expecting.jpg";

const values = [
  {
    icon: Heart,
    title: "Empathy First",
    description: "We understand that homebuying can be overwhelming. Our approach is built on compassion and clarity.",
  },
  {
    icon: Target,
    title: "Equity & Access",
    description:
      "We're committed to closing the homeownership gap and ensuring everyone has a fair shot at the American Dream.",
  },
  {
    icon: Users,
    title: "Community Focused",
    description: "We partner with local counselors and lenders who understand the unique needs of homebuyers.",
  },
  {
    icon: Shield,
    title: "Privacy & Security",
    description:
      "Your data is protected with bank-level encryption. We only collect what's needed and you control your information.",
  },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">About HomeReady</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your trusted guide on the journey to homeownership.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                HomeReady was created to address a critical gap: too many qualified first-time homebuyers, especially in
                Black and underserved communities, don't know where to start or feel overwhelmed by the complex
                homebuying process.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We believe that with the right guidance, transparent information, and access to assistance programs,
                homeownership should be within reach for everyone who's ready and willing to take the journey.
              </p>
            </Card>

            <div>
              <img
                src={familyExpecting}
                alt="Growing Black family planning for their future home"
                className="rounded-xl shadow-lg w-full object-cover aspect-square"
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Our Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <Card key={index} className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                        <p className="text-muted-foreground">{value.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="p-8 bg-accent/10 border-accent">
            <h2 className="text-2xl font-bold mb-4">How We Help</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Guide you through each step with a conversational, judgment-free approach</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Calculate your true affordability with transparent, clear explanations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Match you with down payment assistance programs you qualify for</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Organize your documents into a lender-ready packet</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Provide tools to ensure fair treatment throughout the appraisal process</span>
              </li>
            </ul>
          </Card>

          <div className="text-center">
            <p className="text-muted-foreground">
              Ready to start your journey? Head to our{" "}
              <a href="/" className="text-primary hover:underline font-semibold">
                Home page
              </a>{" "}
              and chat with Haven today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}