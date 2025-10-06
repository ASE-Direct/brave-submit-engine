// API client for document processing

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qpiijzpslfjwikigrbol.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaWlqenBzbGZqd2lraWdyYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NTMwMzIsImV4cCI6MjA3NTAyOTAzMn0.FG4PjphfoigbK8R7DQWCzg2qbQitZKGPiZ5wUtY9AL8';

export interface ProcessingStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  report_url?: string;
}

export interface SavingsSummary {
  total_cost_savings: number;
  savings_percentage: number;
  cartridges_saved: number;
  co2_reduced_pounds: number;
  trees_saved: number;
  total_items: number;
  items_with_savings: number;
}

export interface ProcessingResults {
  summary: SavingsSummary;
  customer: {
    name: string;
    company: string;
    email: string;
  };
  report: {
    pdf_url: string;
    created_at: string;
  };
  items: any[];
  full_report_data: any;
}

/**
 * Start document processing
 */
export async function startProcessing(submissionId: string): Promise<{ processing_job_id: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ submissionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start processing');
  }

  return await response.json();
}

/**
 * Get processing status
 */
export async function getProcessingStatus(submissionId: string): Promise<ProcessingStatus> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-processing-status?submissionId=${submissionId}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get status');
  }

  return await response.json();
}

/**
 * Get processing results
 */
export async function getResults(submissionId: string): Promise<ProcessingResults> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-results?submissionId=${submissionId}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get results');
  }

  return await response.json();
}

/**
 * Poll for processing completion
 */
export async function pollProcessingStatus(
  submissionId: string,
  onProgress: (status: ProcessingStatus) => void,
  interval = 2000
): Promise<ProcessingResults> {
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const status = await getProcessingStatus(submissionId);
        onProgress(status);

        if (status.status === 'completed') {
          clearInterval(poll);
          const results = await getResults(submissionId);
          resolve(results);
        } else if (status.status === 'failed') {
          clearInterval(poll);
          reject(new Error(status.error_message || 'Processing failed'));
        }
      } catch (error) {
        clearInterval(poll);
        reject(error);
      }
    }, interval);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Processing timeout'));
    }, 5 * 60 * 1000);
  });
}

