import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Search, Settings, FileCheck, AlertCircle } from "lucide-react";
import { pollProcessingStatus } from "@/lib/api/processing";

interface ProcessingAnimationProps {
  submissionId: string;
  onComplete?: () => void;
}

const ASE_FACTS = [
  "Founded in 2005 by Service-Disabled Veteran Bo D. Clift, a West Point graduate and former Army officer",
  "ASE Direct is a certified Service-Disabled Veteran-Owned Small Business (SDVOSB) committed to supporting veterans",
  "Named Nashville's Largest Veteran-Owned Business for three consecutive years ('19, '20, '21)",
  "Operates over 60 sales, distribution, collection, and service locations worldwide",
  "Secured over $250 million in federal government contracted revenue",
  "Authorized partner of major brands: HP, Lexmark, Xerox, Canon, Kyocera, Samsung, and Brother",
  "Evolved from a small startup to a multi-million-dollar enterprise serving Fortune 1,000 companies",
  "Remanufactured cartridges consume 79% fewer materials, supporting eco-friendly practices",
  "Offers comprehensive medical and surgical supplies through contracts with Vizient and HealthTrust",
  "Provides a 100% satisfaction guarantee on all products and services",
  "Utilizes AI and automation to optimize supply chain and office operations",
  "Actively promotes supplier diversity to enhance business resilience and innovation",
  "Offers comprehensive managed print services and digital transformation support",
  "Implements sustainability initiatives including toner recycling and ENERGY STAR-compliant products",
  "Engaged in various community initiatives reflecting commitment to social responsibility"
];

export function ProcessingAnimation({ submissionId, onComplete }: ProcessingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [shuffledFacts, setShuffledFacts] = useState<string[]>([]);

  // Shuffle facts on component mount for each new submission
  useEffect(() => {
    const shuffled = [...ASE_FACTS].sort(() => Math.random() - 0.5);
    setShuffledFacts(shuffled);
  }, [submissionId]);

  // Rotate facts every 4.5 seconds
  useEffect(() => {
    if (shuffledFacts.length === 0) return;
    
    const factInterval = setInterval(() => {
      setCurrentFactIndex((prevIndex) => (prevIndex + 1) % shuffledFacts.length);
    }, 4500);

    return () => clearInterval(factInterval);
  }, [shuffledFacts]);

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
      });
  }, [submissionId, onComplete]);

  if (error) {
    const isValidationError = error.includes('missing required information') || error.includes('required information');
    
    return (
      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-6 bg-card rounded-lg shadow-lg">
        <div className="text-center space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl sm:text-2xl font-bold text-red-900">
                {isValidationError ? 'Missing Required Information' : 'Processing Failed'}
              </h2>
            </div>
            <p className="text-sm text-red-800 mb-3 leading-relaxed">{error}</p>
            
            {isValidationError && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-red-100">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  To calculate savings, we need documents with:
                </p>
                <ul className="text-sm text-gray-700 space-y-2 list-none">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><strong>Item Name, SKU, or Item Number</strong> (to identify products)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><strong>Quantity</strong> (number ordered)</span>
                  </li>
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-600">
                    ✓ Accepted documents: Buy sheets, order invoices, quotes, or item usage reports
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button 
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            Upload Different Document
          </Button>
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

      {/* Did you know facts - only show while processing */}
      {progress < 100 && shuffledFacts.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-center space-y-3">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
              Did You Know?
            </h3>
            <div className="h-24 flex items-center justify-center px-4">
              <p 
                key={currentFactIndex}
                className="text-sm sm:text-base text-muted-foreground leading-relaxed animate-fade-in"
              >
                {shuffledFacts[currentFactIndex]}
              </p>
            </div>
            <div className="flex justify-center gap-1.5 pt-2">
              {shuffledFacts.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentFactIndex 
                      ? 'w-8 bg-primary' 
                      : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
