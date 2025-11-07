import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Heart, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CompletionSurveyCardProps {
  onSubmit: () => void;
}

export function CompletionSurveyCard({ onSubmit }: CompletionSurveyCardProps) {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error("Please provide a rating before submitting");
      return;
    }
    toast.success("Thank you for your feedback! 🎉");
    onSubmit();
  };

  const handleSkip = () => {
    onSubmit();
  };

  return (
    <Card className="p-6 md:p-8 shadow-[var(--shadow-card)]">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
          <Heart className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          How Did We Do?
        </h3>
        <p className="text-muted-foreground">
          Your feedback helps us improve SafePlace for future homebuyers
        </p>
      </div>

      <div className="space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3 text-center">
            Rate Your Experience
          </label>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= (hoveredStar || rating)
                      ? "fill-primary text-primary"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              {rating === 5 && "Amazing! We're thrilled! 🎉"}
              {rating === 4 && "Great! We're glad you had a good experience 😊"}
              {rating === 3 && "Good! We'll keep working to improve 👍"}
              {rating === 2 && "Thanks for the feedback. We'll do better 💪"}
              {rating === 1 && "We're sorry. Please tell us how we can improve 🙏"}
            </p>
          )}
        </div>

        {/* Feedback */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            How Could We Improve? (Optional)
          </label>
          <Textarea
            placeholder="Share your thoughts, suggestions, or concerns..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Referral */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Know Someone Who Needs Help?
              </p>
              <p className="text-xs text-muted-foreground">
                We'd love to help your friends and family achieve their homeownership dreams too! 
                Feel free to share SafePlace with anyone looking to buy a home.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
          >
            Skip Survey
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
          >
            Submit Feedback
          </Button>
        </div>
      </div>
    </Card>
  );
}
