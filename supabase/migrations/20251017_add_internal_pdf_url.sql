-- Add internal_pdf_url column to savings_reports table
-- This stores the URL for the internal sales team report

ALTER TABLE savings_reports
ADD COLUMN IF NOT EXISTS internal_pdf_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN savings_reports.internal_pdf_url IS 'URL to internal sales team PDF report with SKU summary and detailed line items';

