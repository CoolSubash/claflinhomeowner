import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import Welcome from "./pages/Welcome";
import HomeCoach from "./pages/HomeCoach";
import FirstSteps from "./pages/FirstSteps";
import FinancialReadiness from "./pages/FinancialReadiness";
import ResourcesAssistance from "./pages/ResourcesAssistance";
import KnowledgeCenter from "./pages/KnowledgeCenter";
import AboutUs from "./pages/AboutUs";
import NotFound from "./pages/NotFound";

function AppContent() {
  const location = useLocation();
  const showNavigation = location.pathname !== "/";

  return (
    <>
      {showNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<HomeCoach />} />
        <Route path="/first-steps" element={<FirstSteps />} />
        <Route path="/financial-readiness" element={<FinancialReadiness />} />
        <Route path="/resources" element={<ResourcesAssistance />} />
        <Route path="/knowledge-center" element={<KnowledgeCenter />} />
        <Route path="/about" element={<AboutUs />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
