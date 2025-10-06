import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, Leaf, FileText, ExternalLink, Download, Calendar, Mail, UserPlus, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { getResults, type ProcessingResults } from "@/lib/api/processing";
import { useToast } from "@/hooks/use-toast";

interface ResultsPageProps {
  submissionId: string;
}

export function ResultsPage({ submissionId }: ResultsPageProps) {
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch results
    getResults(submissionId)
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading results:', error);
        toast({
          title: "Error Loading Results",
          description: error.message || "Failed to load results",
          variant: "destructive",
        });
        setLoading(false);
      });
  }, [submissionId, toast]);

  useEffect(() => {
    if (!results) return;
    
    // Trigger confetti animation on mount
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [results]);

  const handleViewPDF = () => {
    if (results?.report.pdf_url) {
      window.open(results.report.pdf_url, "_blank");
    } else {
      // Fallback to sample
      window.open("/BMO_Savings_Kit.pdf", "_blank");
    }
  };

  const handleDownloadPDF = () => {
    const link = document.createElement("a");
    link.href = results?.report.pdf_url || "/BMO_Savings_Kit.pdf";
    link.download = `BAV_Savings_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    link.click();
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your results...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 text-center">
        <p className="text-red-500">Failed to load results. Please try again.</p>
      </div>
    );
  }

  const { summary, customer, report } = results;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-2 mb-8">
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
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Processing Complete!</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Your optimized report is ready</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
        {/* Results Section - appears first on mobile, second on desktop */}
        <div className="space-y-4 lg:order-2">
          <Card className="bg-card border-2 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Cost Savings</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                    ${summary.total_cost_savings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.savings_percentage.toFixed(1)}% savings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-amber-600/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-amber-600/10 rounded-lg">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Number of Cartridges Saved</p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-700">
                    {summary.cartridges_saved}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.items_with_savings} of {summary.total_items} items optimized
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-green-600/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-green-600/10 rounded-lg">
                  <Leaf className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Pounds of CO₂ Reduced</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">
                    {summary.co2_reduced_pounds.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {summary.trees_saved.toFixed(2)} trees saved
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2 pt-4">
            <Button className="w-full bg-primary hover:bg-primary/90 text-sm sm:text-base">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="truncate">Set Up a Meeting with Sales Rep</span>
            </Button>
            <Button variant="outline" className="w-full text-sm sm:text-base">
              <Mail className="w-4 h-4 mr-2" />
              <span className="truncate">Email These Results</span>
            </Button>
            <Button variant="outline" className="w-full text-sm sm:text-base">
              <UserPlus className="w-4 h-4 mr-2" />
              <span className="truncate">Create Account to Auto-Start Order</span>
            </Button>
          </div>
        </div>

        {/* PDF Preview Section - appears second on mobile, first on desktop */}
        <Card className="bg-card lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[8.5/11] bg-muted rounded-lg border-2 border-border overflow-hidden max-w-md mx-auto relative">
              <iframe
                src={report.pdf_url || "/BMO_Savings_Kit.pdf"}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleViewPDF}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
