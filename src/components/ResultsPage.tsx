import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, Leaf, FileText, ExternalLink, Download, Calendar, Mail, UserPlus } from "lucide-react";
import confetti from "canvas-confetti";

export function ResultsPage() {
  useEffect(() => {
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
  }, []);

  const handleViewPDF = () => {
    // Open PDF in new tab
    window.open("/BMO_Savings_Kit.pdf", "_blank");
  };

  const handleDownloadPDF = () => {
    // Trigger PDF download
    const link = document.createElement("a");
    link.href = "/BMO_Savings_Kit.pdf";
    link.download = "BMO_Savings_Kit.pdf";
    link.click();
  };

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
        {/* PDF Preview Section */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[8.5/11] bg-muted rounded-lg border-2 border-border overflow-hidden max-w-md mx-auto">
              <iframe
                src="/BMO_Savings_Kit.pdf"
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

        {/* Results Section */}
        <div className="space-y-4">
          <Card className="bg-card border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Cost Savings</p>
                  <p className="text-2xl sm:text-3xl font-bold text-secondary">$30,000</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Number of Cartridges Saved</p>
                  <p className="text-2xl sm:text-3xl font-bold text-secondary">400</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                  <Leaf className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Pounds of CO₂ Reduced</p>
                  <p className="text-2xl sm:text-3xl font-bold text-secondary">1,000</p>
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
      </div>
    </div>
  );
}
