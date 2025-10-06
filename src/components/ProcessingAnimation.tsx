import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, FileText, Search, Settings, FileCheck } from "lucide-react";
import { pollProcessingStatus } from "@/lib/api/processing";
import { useToast } from "@/hooks/use-toast";

interface ProcessingAnimationProps {
  submissionId: string;
  onComplete?: () => void;
}

export function ProcessingAnimation({ submissionId, onComplete }: ProcessingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    pollProcessingStatus(
      submissionId,
      (status) => {
        setProgress(status.progress);
        setCurrentStep(status.current_step);
      }
    )
      .then(() => {
        if (onComplete) {
          onComplete();
        }
      })
      .catch((err) => {
        console.error('Processing error:', err);
        setError(err.message);
        toast({
          title: "Processing Failed",
          description: err.message || "An error occurred during processing",
          variant: "destructive",
        });
      });
  }, [submissionId, onComplete, toast]);

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-6 bg-card rounded-lg shadow-lg">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-5xl">✕</div>
          <h2 className="text-2xl font-bold text-secondary">Processing Failed</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-8 bg-card rounded-lg shadow-lg">
      <div className="text-center space-y-2">
        <div className="flex justify-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <svg
              key={i}
              className="w-4 h-4 sm:w-6 sm:h-6 fill-primary"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Processing Your Document</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Please wait while we analyze your order</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      <div className="p-6 rounded-lg border-2 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-4">
          <div className="animate-spin">
            <Settings className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-secondary">{currentStep}</p>
            <p className="text-sm text-muted-foreground">This may take up to 2 minutes...</p>
          </div>
        </div>
      </div>

      {progress === 100 && (
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
          <h2 className="text-2xl font-bold text-secondary">Processing Complete!</h2>
          <p className="text-muted-foreground">Loading your results...</p>
        </div>
      )}
    </div>
  );
}
