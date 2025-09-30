import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, FileText, Search, Settings, FileCheck } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Processing and Parsing Document",
    description: "Using OCR to extract data from your document",
    icon: FileText,
    duration: 5000,
  },
  {
    id: 2,
    title: "Cross-Referencing SKUs",
    description: "Using AI to match products with BAV vendors",
    icon: Search,
    duration: 5000,
  },
  {
    id: 3,
    title: "Optimizing Order Quantities",
    description: "Adjusting yield quantities for optimal efficiency",
    icon: Settings,
    duration: 5000,
  },
  {
    id: 4,
    title: "Generating Final Report",
    description: "Compiling your optimized order report",
    icon: FileCheck,
    duration: 5000,
  },
];

export function ProcessingAnimation({ onComplete }: { onComplete?: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= STEPS.length) {
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const stepDuration = STEPS[currentStep].duration;
    const interval = 100;
    const increment = (interval / stepDuration) * 100;

    const timer = setInterval(() => {
      setStepProgress((prev) => {
        if (prev >= 100) {
          setCompletedSteps((completed) => [...completed, currentStep]);
          setCurrentStep((step) => step + 1);
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentStep, onComplete]);

  const overallProgress = ((currentStep + stepProgress / 100) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-8 bg-card rounded-lg shadow-lg">
      <div className="text-center space-y-2">
        <div className="flex justify-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <svg
              key={i}
              className="w-6 h-6 fill-primary"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-secondary">Processing Your Document</h1>
        <p className="text-muted-foreground">Please wait while we optimize your order</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-3" />
      </div>

      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index;
          const isPending = index > currentStep;

          return (
            <div
              key={step.id}
              className={`
                flex items-start gap-4 p-4 rounded-lg border-2 transition-all duration-300
                ${isCompleted ? "border-primary bg-primary/5" : ""}
                ${isCurrent ? "border-primary bg-primary/10 shadow-md" : ""}
                ${isPending ? "border-border opacity-50" : ""}
              `}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="w-8 h-8 text-primary" />
                ) : (
                  <Icon
                    className={`w-8 h-8 ${isCurrent ? "text-primary animate-pulse" : "text-muted-foreground"}`}
                  />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-secondary">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {isCurrent && (
                  <Progress value={stepProgress} className="h-2" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {currentStep >= STEPS.length && (
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 mx-auto text-primary" />
          <h2 className="text-2xl font-bold text-secondary">Processing Complete!</h2>
          <p className="text-muted-foreground">Your optimized report has been generated</p>
        </div>
      )}
    </div>
  );
}
