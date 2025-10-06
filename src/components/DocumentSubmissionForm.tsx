import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import ReCAPTCHA from "react-google-recaptcha";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { ProcessingAnimation } from "@/components/ProcessingAnimation";
import { ResultsPage } from "@/components/ResultsPage";
import { useToast } from "@/hooks/use-toast";
import { getRecaptchaSiteKey } from "@/config/recaptcha";
import { submitDocument } from "@/lib/supabase";
import { startProcessing } from "@/lib/api/processing";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  company: z.string().min(1, "Company is required").max(200),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address").max(255),
  phone: z.string()
    .min(1, "Phone number is required")
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 10, "Phone number must be exactly 10 digits"),
});

type FormData = z.infer<typeof formSchema>;

export function DocumentSubmissionForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const { toast } = useToast();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      email: "",
      phone: "",
    },
  });

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const onSubmit = async (data: FormData) => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please upload a file",
        variant: "destructive",
      });
      return;
    }

    if (!captchaToken) {
      toast({
        title: "Error",
        description: "Please complete the reCAPTCHA verification",
        variant: "destructive",
      });
      return;
    }

    try {
      // Submit to Supabase Edge Function
      const result = await submitDocument({
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        email: data.email,
        phone: data.phone,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        captchaToken: captchaToken,
      }, file);

      console.log("Submission successful:", result);
      
      // Save submission ID for processing
      setSubmissionId(result.submissionId);
      
      // Start background processing
      try {
        await startProcessing(result.submissionId);
        
        toast({
          title: "Success!",
          description: "Your document is being processed",
        });
        
        setIsProcessing(true);
      } catch (procError) {
        console.error("Processing error:", procError);
        toast({
          title: "Processing Error",
          description: "Document uploaded but processing failed. Please contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit form. Please try again.",
        variant: "destructive",
      });
      
      // Reset reCAPTCHA on error
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    if (token) {
      console.log("reCAPTCHA verified:", token);
    }
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
    toast({
      title: "reCAPTCHA Expired",
      description: "Please verify again",
      variant: "destructive",
    });
  };

  const handleCaptchaError = () => {
    setCaptchaToken(null);
    toast({
      title: "reCAPTCHA Error",
      description: "Failed to load reCAPTCHA. Please refresh the page.",
      variant: "destructive",
    });
  };

  if (showResults && submissionId) {
    return <ResultsPage submissionId={submissionId} />;
  }

  if (isProcessing && submissionId) {
    return (
      <ProcessingAnimation 
        submissionId={submissionId}
        onComplete={() => setShowResults(true)} 
      />
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-6 bg-card rounded-lg shadow-lg">
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
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary">BAV Savings Challenge</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Upload your most recent monthly or annual purchase order!</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <Input 
                    type="tel" 
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      let formatted = value;
                      
                      if (value.length >= 3) {
                        formatted = `(${value.slice(0, 3)})`;
                        if (value.length > 3) {
                          formatted += ` ${value.slice(3, 6)}`;
                          if (value.length > 6) {
                            formatted += `-${value.slice(6, 10)}`;
                          }
                        }
                      }
                      
                      field.onChange(formatted);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FileUpload
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            selectedFile={file}
          />

          <div className="flex flex-col items-center gap-2">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={getRecaptchaSiteKey()}
              onChange={handleCaptchaChange}
              onExpired={handleCaptchaExpired}
              onErrored={handleCaptchaError}
              theme="light"
            />
            <p className="text-xs text-muted-foreground text-center">
              This site is protected by reCAPTCHA
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isUploading || !file || !captchaToken}
          >
            Submit Document
          </Button>
        </form>
      </Form>
    </div>
  );
}
