import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, HelpCircle, FileText, Video } from "lucide-react";

const articles = [
  {
    title: "Understanding Your Credit Score",
    category: "Credit",
    summary: "Learn what affects your credit score and how to improve it",
  },
  {
    title: "Down Payment vs. Closing Costs",
    category: "Financing",
    summary: "Know the difference and plan your savings accordingly",
  },
  {
    title: "What is PMI?",
    category: "Insurance",
    summary: "Private Mortgage Insurance explained in plain language",
  },
  {
    title: "How to Read Your Pre-Approval Letter",
    category: "Process",
    summary: "Decode the terms and conditions in your pre-approval",
  },
];

const faqs = [
  {
    question: "How much do I need for a down payment?",
    answer: "While 20% is traditional, many programs allow 3-5% down, and some assistance programs can cover your entire down payment.",
  },
  {
    question: "What credit score do I need?",
    answer: "Most conventional loans require 620+, but FHA loans may accept scores as low as 580. Some assistance programs have flexible requirements.",
  },
  {
    question: "How long does the process take?",
    answer: "From application to closing typically takes 30-45 days, but preparation (improving credit, saving funds) can take several months.",
  },
];

export default function KnowledgeCenter() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">Knowledge Center</h1>
            <p className="text-lg text-muted-foreground">
              Your library of homebuying education, from basics to advanced topics.
            </p>
          </div>

          <Tabs defaultValue="articles" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="faqs">FAQs</TabsTrigger>
              <TabsTrigger value="glossary">Glossary</TabsTrigger>
            </TabsList>

            <TabsContent value="articles" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {articles.map((article, index) => (
                  <Card key={index} className="p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">{article.category}</div>
                        <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                        <p className="text-sm text-muted-foreground">{article.summary}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="faqs" className="space-y-4">
              {faqs.map((faq, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 flex-shrink-0">
                      <HelpCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="glossary" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">PITI</h3>
                    <p className="text-muted-foreground">
                      Principal, Interest, Taxes, and Insurance - the four components of your monthly mortgage payment.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">DTI (Debt-to-Income Ratio)</h3>
                    <p className="text-muted-foreground">
                      The percentage of your monthly income that goes toward debt payments. Lenders use this to assess your ability to repay.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
