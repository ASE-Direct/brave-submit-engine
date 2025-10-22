import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface EmailNotificationRequest {
  userInfo: {
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    phone: string;
  };
  uploadedDocumentUrl: string;
  internalReportUrl: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Parse request body
    const { userInfo, uploadedDocumentUrl, internalReportUrl }: EmailNotificationRequest = await req.json();

    // Validate required fields
    if (!userInfo || !uploadedDocumentUrl || !internalReportUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define recipients - ALL 7 RECIPIENTS ACTIVE
    const recipients = [
      'areyes@gowaffl.com',
      'zjones@gowaffl.com',
      'rwright@gowaffl.com',
      'jud@asedirect.com',
      'bo@asedirect.com',
      'sgibson@asedirect.com',
      'bnaron@asedirect.com'
    ];
    
    console.log(`📧 Sending email notification to ${recipients.length} recipients:`);
    console.log(`   Recipients: ${recipients.join(', ')}`);
    console.log(`   User: ${userInfo.firstName} ${userInfo.lastName} (${userInfo.company})`);

    // Prepare email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #0066cc;
              color: white;
              padding: 20px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              background-color: #f9f9f9;
              border: 1px solid #ddd;
              border-top: none;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .info-table {
              width: 100%;
              margin: 20px 0;
              border-collapse: collapse;
              background-color: white;
              border-radius: 4px;
              overflow: hidden;
            }
            .info-table td {
              padding: 12px;
              border-bottom: 1px solid #eee;
            }
            .info-table td:first-child {
              font-weight: 600;
              width: 140px;
              background-color: #f5f5f5;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              margin: 10px 10px 10px 0;
              background-color: #0066cc;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
            }
            .button:hover {
              background-color: #0052a3;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎯 New BAV Savings Challenge Submission</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">
              A savings challenge was completed by <strong>${userInfo.firstName} ${userInfo.lastName}</strong>.
            </p>
            
            <table class="info-table">
              <tr>
                <td>Customer Name</td>
                <td>${userInfo.firstName} ${userInfo.lastName}</td>
              </tr>
              <tr>
                <td>Company</td>
                <td>${userInfo.company}</td>
              </tr>
              <tr>
                <td>Email</td>
                <td><a href="mailto:${userInfo.email}">${userInfo.email}</a></td>
              </tr>
              <tr>
                <td>Phone</td>
                <td>${userInfo.phone}</td>
              </tr>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px;">Documents</h3>
            <p>Click the buttons below to access the submission documents:</p>
            
            <div style="margin: 20px 0;">
              <a href="${uploadedDocumentUrl}" class="button" style="color: white;">
                📄 Download User's Document
              </a>
              <a href="${internalReportUrl}" class="button" style="color: white; background-color: #28a745;">
                📊 Download Internal Report
              </a>
            </div>

            <p style="font-size: 13px; color: #666; margin-top: 20px;">
              <strong>Note:</strong> These download links will expire in 72 hours.
            </p>

            <div class="footer">
              <p>This is an automated notification from the BAV Savings Challenge system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Prepare plain text version
    const emailText = `
New BAV Savings Challenge Submission

A savings challenge was completed by ${userInfo.firstName} ${userInfo.lastName}.

Customer Details:
- Name: ${userInfo.firstName} ${userInfo.lastName}
- Company: ${userInfo.company}
- Email: ${userInfo.email}
- Phone: ${userInfo.phone}

Documents:
- User's Document: ${uploadedDocumentUrl}
- Internal Report: ${internalReportUrl}

Note: These download links will expire in 72 hours.

---
This is an automated notification from the BAV Savings Challenge system.
    `.trim();

    // Send email via Resend API
    const emailPayload = {
      from: 'BAV Savings Challenge <noreply@bavsavingschallenge.com>',
      to: recipients,
      subject: `New BAV Savings Challenge Submission - ${userInfo.company}`,
      html: emailHtml,
      text: emailText,
    };
    
    console.log('📤 Sending to Resend API with payload:');
    console.log(`   to: ${JSON.stringify(emailPayload.to)}`);
    console.log(`   from: ${emailPayload.from}`);
    console.log(`   subject: ${emailPayload.subject}`);
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('❌ Resend API error:', resendData);
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    console.log('✅ Email sent successfully:', resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent',
        emailId: resendData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending email notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send email notification',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

