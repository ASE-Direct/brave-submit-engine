import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const submissionId = url.searchParams.get('submissionId');

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: 'Missing submissionId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get the savings report
    const { data: report, error: reportError } = await supabase
      .from('savings_reports')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the detailed breakdown from order_items_extracted
    const { data: items, error: itemsError } = await supabase
      .from('order_items_extracted')
      .select(`
        *,
        matched_product:matched_product_id(sku, product_name, unit_price, page_yield, wholesaler_sku, oem_number),
        recommended_product:recommended_product_id(sku, product_name, unit_price, page_yield, wholesaler_sku, oem_number)
      `)
      .eq('processing_job_id', report.processing_job_id)
      .order('cost_savings', { ascending: false, nullsFirst: false });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    // Return complete results
    return new Response(
      JSON.stringify({
        summary: {
          total_cost_savings: report.total_cost_savings,
          savings_percentage: report.savings_percentage,
          cartridges_saved: report.cartridges_saved,
          co2_reduced_pounds: report.co2_reduced_pounds,
          trees_saved: report.trees_saved,
          total_items: report.total_items,
          items_with_savings: report.items_with_savings
        },
        customer: {
          name: report.customer_name,
          company: report.company_name,
          email: report.email
        },
        report: {
          pdf_url: report.pdf_url,
          created_at: report.created_at
        },
        items: items || [],
        full_report_data: report.report_data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

