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

  // Executive Summary Box
  doc.setFillColor(lightGray);
  doc.rect(margin, yPos, contentWidth, 45, 'F');
  
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

  yPos += 25;

  // Environmental Impact Box
  yPos += 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(brandRed);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, 55, 'D');
  
  yPos += 8;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Environmental Impact', margin + 5, yPos);
  
  yPos += 10;

  // Environmental metrics - Row 1: 3 columns
  const envCol1 = margin + 5;
  const envCol2 = margin + contentWidth / 3;
  const envCol3 = margin + (contentWidth * 2 / 3);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  // Cartridges Saved
  doc.text('Cartridges Saved', envCol1, yPos);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`${data.summary.environmental.cartridges_saved}`, envCol1, yPos + 7);
  
  // CO2 Reduced
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('CO₂ Reduced (lbs)', envCol2, yPos);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`${data.summary.environmental.co2_reduced_pounds.toFixed(0)}`, envCol2, yPos + 7);
  
  // Trees Saved
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('Trees Equivalent', envCol3, yPos);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`${data.summary.environmental.trees_saved.toFixed(2)}`, envCol3, yPos + 7);

  yPos += 18;

  // Environmental metrics - Row 2: 2 columns
  const envCol1Row2 = margin + 5;
  const envCol2Row2 = margin + contentWidth / 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  // Plastic Reduced
  doc.text('Plastic Reduced (lbs)', envCol1Row2, yPos);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`${data.summary.environmental.plastic_reduced_pounds.toFixed(0)}`, envCol1Row2, yPos + 7);
  
  // Shipping Weight Saved
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('Shipping Weight Saved (lbs)', envCol2Row2, yPos);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`${data.summary.environmental.shipping_weight_saved_pounds.toFixed(1)}`, envCol2Row2, yPos + 7);

  yPos += 20;

  // Key Quality Benefits Section
  yPos += 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(brandNavy);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, 70, 'D');
  
  yPos += 8;
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('💡 Key Quality Benefits When You Switch', margin + 5, yPos);
  
  yPos += 8;

  // Benefits list with checkmarks
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const benefits = [
    '✅ 2-year Warranty Guarantee',
    '✅ STMC & ISO Certified – Certified for performance, yield, and reliability',
    '✅ Independent Lab Tested – Validated by Buyer\'s Lab for quality and consistency',
    '✅ Green Choice – Reduces landfill waste & cuts environmental impact by 50%',
    '✅ World\'s Largest Cartridge Recycler. OEM-Equivalent, EcoLabel Certified.',
    '✅ Tariff-Free – Avoid hidden import fees and volatile overseas pricing',
    '✅ Delivery Time – 2-day Delivery',
    '✅ Veteran-Owned – 5% of profits donated to U.S. Military Veteran support orgs.'
  ];
  
  benefits.forEach((benefit) => {
    const benefitLines = doc.splitTextToSize(benefit, contentWidth - 10);
    benefitLines.forEach((line: string) => {
      doc.text(line, margin + 5, yPos);
      yPos += 4;
    });
    yPos += 2; // Extra spacing between benefits
  });

  yPos += 5;

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
      
      doc.setFillColor(lightGray);
      doc.rect(margin, yPos, contentWidth, boxHeight, 'F');
      
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

      // Savings badge
      if (item.savings) {
        const savingsX = pageWidth - margin - 45;
        const savingsY = yPos - 35;
        
        doc.setFillColor(brandRed);
        doc.roundedRect(savingsX, savingsY, 40, 15, 2, 2, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('SAVE', savingsX + 3, savingsY + 6);
        doc.setFontSize(12);
        doc.text(`$${item.savings.cost_savings.toFixed(0)}`, savingsX + 3, savingsY + 12);
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
  doc.text('Email: sales@bav.com', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text('Phone: 1-800-BAV-SAVE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text('Web: www.betteramericanvalue.com', pageWidth / 2, yPos, { align: 'center' });

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

