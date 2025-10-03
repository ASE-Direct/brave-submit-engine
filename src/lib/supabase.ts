// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qpiijzpslfjwikigrbol.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaWlqenBzbGZqd2lraWdyYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NTMwMzIsImV4cCI6MjA3NTAyOTAzMn0.FG4PjphfoigbK8R7DQWCzg2qbQitZKGPiZ5wUtY9AL8';

// Types for our form submission
export interface SubmissionData {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  captchaToken: string;
  fileData: string; // Base64 encoded file
}

export interface SubmissionResponse {
  success: boolean;
  message: string;
  submissionId?: string;
  fileUrl?: string;
  error?: string;
  details?: string;
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

// Submit document to Supabase Edge Function
export async function submitDocument(
  data: Omit<SubmissionData, 'fileData'>,
  file: File
): Promise<SubmissionResponse> {
  try {
    // Convert file to base64
    const fileData = await fileToBase64(file);

    const response = await fetch(`${supabaseUrl}/functions/v1/submit-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        ...data,
        fileData,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Submission failed');
    }

    return result;
  } catch (error) {
    console.error('Submission error:', error);
    throw error;
  }
}

