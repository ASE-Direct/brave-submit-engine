// Supabase configuration
// IMPORTANT: These values MUST be set in environment variables
// Never commit actual API keys or tokens to the repository
// See env.example for setup instructions
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file. See env.example for setup instructions.'
  );
}

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

