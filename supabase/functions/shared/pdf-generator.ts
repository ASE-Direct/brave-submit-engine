/**
 * PDF Report Generator
 * 
 * Generates branded PDF reports with savings analysis
 */

import { jsPDF } from 'npm:jspdf@2.5.2';
import { BAV_LOGO_BASE64 } from './logoData.ts';

interface ReportData {
  customer: {
    firstName: string;
    lastName: string;
    company: string;
    email: string;
  };
  summary: {
    total_current_cost: number;
    total_optimized_cost: number;
    total_cost_savings: number;
    savings_percentage: number;
    total_items: number;
    items_with_savings: number;
    environmental: {
      cartridges_saved: number;
      co2_reduced_pounds: number;
      trees_saved: number;
      plastic_reduced_pounds: number;
    };
  };
  breakdown: Array<{
    current_product: {
      name: string;
      sku: string;
      wholesaler_sku?: string | null;
      quantity: number;
      unit_price: number;
      total_cost: number;
    };
    recommended_product?: {
      name: string;
      sku: string;
      wholesaler_sku?: string | null;
      quantity_needed: number;
      unit_price: number;
      total_cost: number;
      bulk_discount_applied?: boolean;
    };
    savings?: {
      cost_savings: number;
      cost_savings_percentage: number;
      cartridges_saved: number;
      co2_reduced: number;
    };
    reason?: string;
    recommendation_type?: string;
    message?: string; // Transparency message for assumed pricing
    price_source?: string; // Source of pricing (user_file, catalog_list_price, etc.)
  }>;
}

/**
 * Generate PDF report
 */
export async function generatePDFReport(data: ReportData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Colors matching BAV brand
  const brandRed = '#C00000';
  const brandNavy = '#2A2963';
  const lightGray = '#F5F5F5';
  const darkGray = '#666666';
  const brandGreen = '#22C55E';      // Modern green for environmental
  const lightGreen = '#F0FDF4';      // Light green background
  const darkGreen = '#15803D';       // Dark green for emphasis

  let yPos = 20;

  // ===== PAGE 1: HEADER & SUMMARY =====

  // BAV Logo - embedded PNG from public/bav-logo-2.png
  try {
    // Add logo image - PNG format works reliably with jsPDF
    doc.addImage(BAV_LOGO_BASE64, 'PNG', margin, yPos - 5, 50, 24);
    yPos += 32; // Increased spacing after logo
  } catch (error) {
    console.error('Failed to add logo image:', error);
    // Fallback to text-based logo if image fails
    doc.setFontSize(18);
    doc.setTextColor(brandRed);
    doc.setFont('helvetica', 'normal');
    const starSpacing = 6;
    for (let i = 0; i < 5; i++) {
      doc.text('★', margin + (i * starSpacing), yPos);
    }
    yPos += 8;
    doc.setFontSize(16);
    doc.setTextColor(brandNavy);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY', margin, yPos);
    yPos += 7;
    doc.setFontSize(24);
    doc.setTextColor(brandRed);
    doc.text('AMERICAN', margin, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.setTextColor(brandNavy);
    doc.setFont('helvetica', 'normal');
    doc.text('Buy American Veteran', margin, yPos);
    yPos += 12; // Increased spacing after fallback logo too
  }

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Savings Challenge Report', margin, yPos);
  
  yPos += 12;

  // Customer info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`Prepared for: ${data.customer.firstName} ${data.customer.lastName}`, margin, yPos);
  yPos += 6;
  doc.text(`Company: ${data.customer.company}`, margin, yPos);
  yPos += 6;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, yPos);
  
  yPos += 15;

  // Divider line
  doc.setDrawColor(brandRed);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 12;

  // Executive Summary Box - with modern rounded corners
  doc.setFillColor(245, 245, 245); // Light gray
  doc.roundedRect(margin, yPos, contentWidth, 45, 2, 2, 'F');
  
  yPos += 8;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Executive Summary', margin + 5, yPos);
  
  yPos += 10;

  // Key metrics in columns
  const col1X = margin + 5;
  const col2X = margin + contentWidth / 2;

  // Column 1
  doc.setFontSize(10);
  doc.setTextColor(darkGray);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Cost Savings', col1X, yPos);
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`$${data.summary.total_cost_savings.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, col1X, yPos + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`${data.summary.savings_percentage.toFixed(1)}% savings`, col1X, yPos + 14);

  // Column 2
  doc.setFontSize(10);
  doc.text('Items Analyzed', col2X, yPos);
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`${data.summary.total_items}`, col2X, yPos + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`${data.summary.items_with_savings} with savings`, col2X, yPos + 14);

  yPos += 20;

  // Environmental Impact Box - with green styling
  yPos += 5; // Spacing between Executive Summary and Environmental Impact
  doc.setFillColor(240, 253, 244); // Light green background
  doc.setDrawColor(34, 197, 94); // Green border
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 52, 3, 3, 'FD'); // Rounded corners with fill and draw
  
  yPos += 8;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61); // Dark green for title
  doc.text('Environmental Impact', margin + 5, yPos);
  
  yPos += 10;

  // Environmental metrics - Row 1: 3 columns
  const envCol1 = margin + 5;
  const envCol2 = margin + contentWidth / 3;
  const envCol3 = margin + (contentWidth * 2 / 3);
  const envColWidth = contentWidth / 3;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  // Cartridges Saved
  const cartridgesSavedLabel = 'Cartridges Saved';
  const cartridgesSavedLabelWidth = doc.getTextWidth(cartridgesSavedLabel);
  doc.text(cartridgesSavedLabel, envCol1 + (envColWidth - cartridgesSavedLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green
  const cartridgesSavedValue = `${data.summary.environmental.cartridges_saved}`;
  const cartridgesSavedValueWidth = doc.getTextWidth(cartridgesSavedValue);
  doc.text(cartridgesSavedValue, envCol1 + (envColWidth - cartridgesSavedValueWidth) / 2, yPos + 7);
  
  // CO2 Reduced
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  const co2Label = 'CO₂ Reduced (lbs)';
  const co2LabelWidth = doc.getTextWidth(co2Label);
  doc.text(co2Label, envCol2 + (envColWidth - co2LabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green
  const co2Value = `${data.summary.environmental.co2_reduced_pounds.toFixed(0)}`;
  const co2ValueWidth = doc.getTextWidth(co2Value);
  doc.text(co2Value, envCol2 + (envColWidth - co2ValueWidth) / 2, yPos + 7);
  
  // Trees Saved
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  const treesLabel = 'Trees Equivalent';
  const treesLabelWidth = doc.getTextWidth(treesLabel);
  doc.text(treesLabel, envCol3 + (envColWidth - treesLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green
  const treesValue = `${data.summary.environmental.trees_saved.toFixed(2)}`;
  const treesValueWidth = doc.getTextWidth(treesValue);
  doc.text(treesValue, envCol3 + (envColWidth - treesValueWidth) / 2, yPos + 7);

  yPos += 18;

  // Environmental metrics - Row 2: 2 columns
  const envCol1Row2 = margin + 5;
  const envCol2Row2 = margin + contentWidth / 2;
  const envColWidthRow2 = contentWidth / 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  // Plastic Reduced
  const plasticLabel = 'Plastic Reduced (lbs)';
  const plasticLabelWidth = doc.getTextWidth(plasticLabel);
  doc.text(plasticLabel, envCol1Row2 + (envColWidthRow2 - plasticLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green
  const plasticValue = `${data.summary.environmental.plastic_reduced_pounds.toFixed(0)}`;
  const plasticValueWidth = doc.getTextWidth(plasticValue);
  doc.text(plasticValue, envCol1Row2 + (envColWidthRow2 - plasticValueWidth) / 2, yPos + 7);
  
  // Shipping Weight Saved
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  const shippingLabel = 'Shipping Weight Saved (lbs)';
  const shippingLabelWidth = doc.getTextWidth(shippingLabel);
  doc.text(shippingLabel, envCol2Row2 + (envColWidthRow2 - shippingLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94); // Green
  const shippingValue = `${data.summary.environmental.shipping_weight_saved_pounds.toFixed(1)}`;
  const shippingValueWidth = doc.getTextWidth(shippingValue);
  doc.text(shippingValue, envCol2Row2 + (envColWidthRow2 - shippingValueWidth) / 2, yPos + 7);

  yPos += 20;

  // Key Quality Benefits Section - with modern styling
  yPos += 5; // Spacing between Environmental Impact and Key Quality Benefits
  
  const benefitsBoxStartY = yPos; // Store box start position
  
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(42, 41, 99); // Navy
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 56, 3, 3, 'D'); // Fixed height for proper spacing
  
  yPos += 7; // Top padding inside the box
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Key Quality Benefits', margin + 5, yPos);
  
  yPos += 7; // Spacing after title

  // Benefits list with bullet points
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const benefits = [
    '2-year Warranty Guarantee',
    'STMC & ISO Certified - Performance, yield, and reliability tested',
    'Independent Lab Tested - Validated by Buyer\'s Lab for quality',
    'Green Choice - Reduces landfill waste by 50%',
    'World\'s Largest Cartridge Recycler - OEM-Equivalent, EcoLabel Certified',
    'Tariff-Free - Avoid hidden import fees',
    'Fast Delivery - 2-day shipping available',
    'Veteran-Owned - 5% donated to U.S. Military Veteran support'
  ];
  
  benefits.forEach((benefit) => {
    doc.text('•', margin + 5, yPos);
    const benefitLines = doc.splitTextToSize(benefit, contentWidth - 15);
    benefitLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 9, yPos);
      if (idx < benefitLines.length - 1) yPos += 3.5;
    });
    yPos += 4; // Spacing between benefits
  });

  // Move yPos to the end of the box (independent of text content)
  yPos = benefitsBoxStartY + 56 + 10; // Box height + spacing after box

  // ===== PAGE 2+: DETAILED BREAKDOWN =====
  
  // Show all items with recommendations (whether they have calculated savings or not)
  const itemsToShow = data.breakdown.filter(item => 
    item.recommended_product // Show any item that has a recommendation
  );

  if (itemsToShow.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandNavy);
    doc.text('Detailed Product Analysis', margin, yPos);
    
    yPos += 10;

    // Sort by savings (highest first), but include items without savings at the end
    itemsToShow.sort((a, b) => 
      (b.savings?.cost_savings || 0) - (a.savings?.cost_savings || 0)
    );

    let itemCount = 0;
    const maxItemsPerPage = 3;

    for (const item of itemsToShow) {
      // Check if we need a new page
      if (itemCount > 0 && itemCount % maxItemsPerPage === 0) {
        doc.addPage();
        yPos = 20;
      }

      // Item box - increased height to accommodate wholesaler SKU
      const boxHeight = 65;
      const boxStartY = yPos; // Store box start position for SAVE badge
      
      doc.setFillColor(245, 245, 245); // Light gray
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'F'); // Rounded corners
      
      yPos += 8;

      // Current Product
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(brandNavy);
      doc.text('Current:', margin + 3, yPos);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray);
      
      const currentName = doc.splitTextToSize(item.current_product.name, contentWidth - 10);
      doc.text(currentName[0], margin + 3, yPos + 5);
      
      // Show wholesaler SKU if available
      const currentSkuText = item.current_product.wholesaler_sku 
        ? `SKU: ${item.current_product.sku} | Wholesaler: ${item.current_product.wholesaler_sku}`
        : `SKU: ${item.current_product.sku}`;
      doc.text(currentSkuText, margin + 3, yPos + 9);
      
        const currentPriceText = item.current_product.unit_price > 0
          ? `${item.current_product.quantity} × $${item.current_product.unit_price.toFixed(2)} = $${item.current_product.total_cost.toFixed(2)}`
          : `${item.current_product.quantity} units (Price not available)`;
        doc.text(currentPriceText, margin + 3, yPos + 13);

      // Display transparency message if pricing was assumed
      let messageOffset = 0;
      if (item.message) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100); // Gray color for message
        const messageLines = doc.splitTextToSize(item.message, contentWidth - 10);
        messageLines.forEach((line: string, idx: number) => {
          doc.text(line, margin + 3, yPos + 17 + (idx * 4));
          messageOffset = (idx + 1) * 4;
        });
        doc.setFont('helvetica', 'normal'); // Reset font
        doc.setTextColor(darkGray); // Reset color
      }

      yPos += 18 + messageOffset;

      // Recommended Product
      if (item.recommended_product) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandRed);
        doc.text('Recommended:', margin + 3, yPos);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(darkGray);
        
        const recName = doc.splitTextToSize(item.recommended_product.name, contentWidth - 10);
        doc.text(recName[0], margin + 3, yPos + 5);
        
        // Show wholesaler SKU if available
        const recSkuText = item.recommended_product.wholesaler_sku 
          ? `SKU: ${item.recommended_product.sku} | Wholesaler: ${item.recommended_product.wholesaler_sku}`
          : `SKU: ${item.recommended_product.sku}`;
        doc.text(recSkuText, margin + 3, yPos + 9);
        
        const recPriceText = item.recommended_product.unit_price > 0
          ? `${item.recommended_product.quantity_needed} × $${item.recommended_product.unit_price.toFixed(2)} = $${item.recommended_product.total_cost.toFixed(2)}`
          : `${item.recommended_product.quantity_needed} units (Price not available)`;
        doc.text(recPriceText, margin + 3, yPos + 13);
        
        if (item.recommended_product.bulk_discount_applied) {
          doc.setTextColor(brandRed);
          doc.text('(Bulk discount applied)', margin + 3, yPos + 17);
        }
      }

      yPos += 18;

      // Savings badge - positioned in top-right corner of box
      if (item.savings) {
        const savingsX = pageWidth - margin - 42;
        const savingsY = boxStartY + 5; // Position 5mm from top of box
        
        doc.setFillColor(192, 0, 0); // Brand red
        doc.roundedRect(savingsX, savingsY, 38, 16, 2, 2, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('SAVE', savingsX + 3, savingsY + 6);
        doc.setFontSize(11);
        doc.text(`$${item.savings.cost_savings.toFixed(0)}`, savingsX + 3, savingsY + 13);
      }

      // Reason
      if (item.reason) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(darkGray);
        const reasonText = doc.splitTextToSize(item.reason, contentWidth - 10);
        doc.text(reasonText, margin + 3, yPos);
      }

      yPos += 10;
      itemCount++;
    }
  }

  // ===== FINAL PAGE: CALL TO ACTION =====
  doc.addPage();
  yPos = pageHeight / 3;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Ready to Start Saving?', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  const ctaText = [
    'Our team is ready to help you implement these savings',
    'and start reducing both costs and environmental impact.',
    '',
    'Contact us today to get started!'
  ];
  
  ctaText.forEach(line => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
  });

  yPos += 15;

  // Contact box
  doc.setFillColor(brandNavy);
  doc.roundedRect(margin + 30, yPos, contentWidth - 60, 30, 3, 3, 'F');
  
  yPos += 10;

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('Email: sales@asedirect.com', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text('Phone: 888-204-1938', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text('Web: www.asedirect.com', pageWidth / 2, yPos, { align: 'center' });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(darkGray);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BAV Savings Challenge Report | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    
    // Copyright
    doc.text(
      `© ${new Date().getFullYear()} Buy American Veteran. All rights reserved.`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Return as Uint8Array
  return doc.output('arraybuffer') as Uint8Array;
}

/**
 * Helper to format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

