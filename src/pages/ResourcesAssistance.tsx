import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { NC_DPA_PROGRAMS } from "@/data/seedData";

const additionalResources = [
  {
    title: "HUD-Approved Housing Counselors",
    description: "Find certified counselors in your area",
    url: "https://www.hud.gov/findacounselor",
  },
  {
    title: "Consumer Financial Protection Bureau",
    description: "Learn about mortgages and your rights",
    url: "https://www.consumerfinance.gov/owning-a-home/",
  },
  {
    title: "Federal Housing Finance Agency",
    description: "Federal programs and resources for homebuyers",
    url: "https://www.fhfa.gov/",
  },
];

export default function ResourcesAssistance() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">Resources and Assistance Programs</h1>
            <p className="text-lg text-muted-foreground">
              Discover financial assistance programs and helpful resources for first-time homebuyers.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Down Payment Assistance Programs</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {NC_DPA_PROGRAMS.map((program, index) => (
                <Card key={index} className="p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">{program.name}</h3>
                  <p className="text-muted-foreground mb-4">{program.why_qualify}</p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>Estimated Amount:</strong> ${program.est_amount.toLocaleString()}
                    </p>
                    <p className="text-sm">
                      <strong>Requirements:</strong> {program.requirements.join(", ")}
                    </p>
                    {program.url && (
                      <a
                        href={program.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      >
                        Learn more <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Additional Resources</h2>
            <div className="space-y-4">
              {additionalResources.map((resource, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{resource.title}</h3>
                      <p className="text-muted-foreground">{resource.description}</p>
                    </div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-primary hover:underline"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}