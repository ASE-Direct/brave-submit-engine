/**
 * Customer-Facing PDF Report Generator
 * 
 * Generates simplified 3-page PDF reports for customers
 * - Page 1: Executive Summary with SKU breakdown
 * - Page 2: Environmental Impact & Key Benefits
 * - Page 3: Contact/CTA
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
    remanufactured_count: number;
    oem_count: number;
    no_match_count: number;
    environmental: {
      cartridges_saved: number;
      co2_reduced_pounds: number;
      trees_saved: number;
      plastic_reduced_pounds: number;
      shipping_weight_saved_pounds?: number;
    };
  };
  breakdown: Array<{
    match_type: 'remanufactured' | 'oem' | 'no_match';
    ase_sku: string | null;
    current_product: {
      name: string;
      sku: string;
      quantity: number;
      unit_price: number;
      total_cost: number;
    };
    recommended_product?: {
      name: string;
      sku: string;
      quantity_needed: number;
      unit_price: number;
      total_cost: number;
    };
    savings?: {
      cost_savings: number;
    };
  }>;
}

/**
 * Generate customer-facing PDF report (3 pages only)
 */
export async function generateCustomerPDFReport(data: ReportData): Promise<Uint8Array> {
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
  const brandGreen = '#22C55E';
  const lightGreen = '#F0FDF4';
  const darkGreen = '#15803D';

  let yPos = 20;

  // ===== PAGE 1: HEADER & EXECUTIVE SUMMARY =====

  // BAV Logo
  try {
    doc.addImage(BAV_LOGO_BASE64, 'PNG', margin, yPos - 5, 50, 24);
    yPos += 32;
  } catch (error) {
    console.error('Failed to add logo image:', error);
    yPos += 20;
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
  
  yPos += 10;

  // Executive Summary Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Executive Summary', margin, yPos);
  
  yPos += 12;

  // Calculate unique SKU count
  const uniqueSkus = new Set(
    data.breakdown
      .filter(item => item.ase_sku)
      .map(item => item.ase_sku)
  );

  // Purchase Volume Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('OEM SKUs (19 unique)', margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const oemLines = [
    `(${data.summary.total_items}) line items`,
    `${data.summary.total_items} total items analyzed`,
    `$${data.summary.total_current_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} OEM Mkt. basket`
  ];
  
  oemLines.forEach(line => {
    doc.text(line, margin + 5, yPos);
    yPos += 5;
  });
  
  yPos += 8;

  // Remanufactured SKUs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`Remanufactured SKUs (${data.summary.remanufactured_count || 0} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  // Calculate line items and total cost for remanufactured
  const remanItems = data.breakdown.filter(item => item.match_type === 'remanufactured');
  const remanLineCount = remanItems.length;
  const remanTotalCost = remanItems.reduce((sum, item) => sum + (item.recommended_product?.total_cost || 0), 0);
  
  const remanLines = [
    `(${remanLineCount}) line items`,
    `${remanLineCount} total items analyzed`,
    `$${remanTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Reman. Mkt. basket`
  ];
  
  remanLines.forEach(line => {
    doc.text(line, margin + 5, yPos);
    yPos += 5;
  });
  
  yPos += 8;

  // OEM Like Kind Exchange Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`OEM Like Kind Exchange (${data.summary.oem_count || 0} unique)`, margin, yPos);
  
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(darkGray);
  doc.text('(if we use the ase_oem_number) for a savings', margin + 5, yPos);
  
  yPos += 8;

  // No Match Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`No Match OEM (${data.summary.no_match_count || 0} items)`, margin, yPos);
  
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('TBD (to be determined)', margin + 5, yPos);
  
  yPos += 12;

  // Savings Opportunity Breakdown
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Savings Opportunity Breakdown', margin, yPos);
  
  yPos += 10;

  // Savings metrics in columns
  const col1X = margin + 5;
  const col2X = margin + contentWidth / 2;

  // OEM Total Spend
  doc.setFontSize(10);
  doc.setTextColor(darkGray);
  doc.setFont('helvetica', 'normal');
  doc.text('OEM Total Spend', col1X, yPos);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`$${data.summary.total_current_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, col1X, yPos + 8);

  // BAV Total Spend
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('BAV Total Spend', col2X, yPos);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`$${data.summary.total_optimized_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, col2X, yPos + 8);

  yPos += 20;

  // Total Savings (highlighted)
  doc.setFillColor(240, 253, 244); // Light green background
  doc.setDrawColor(34, 197, 94); // Green border
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, 'FD');
  
  yPos += 8;
  
  doc.setFontSize(11);
  doc.setTextColor(darkGray);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Savings', margin + 5, yPos);
  
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed);
  doc.text(`$${data.summary.total_cost_savings.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, margin + 5, yPos + 10);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGreen);
  doc.text(`${data.summary.savings_percentage.toFixed(1)}% savings`, pageWidth - margin - 40, yPos + 10);

  // ===== PAGE 2: ENVIRONMENTAL IMPACT & KEY BENEFITS =====
  doc.addPage();
  yPos = 20;

  // Environmental Impact Box
  const envBoxHeight = 52;
  
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, envBoxHeight, 3, 3, 'FD');
  
  yPos += 8;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
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
  doc.setTextColor(34, 197, 94);
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
  doc.setTextColor(34, 197, 94);
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
  doc.setTextColor(34, 197, 94);
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
  doc.setTextColor(34, 197, 94);
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
  doc.setTextColor(34, 197, 94);
  const shippingValue = `${(data.summary.environmental.shipping_weight_saved_pounds || 0).toFixed(1)}`;
  const shippingValueWidth = doc.getTextWidth(shippingValue);
  doc.text(shippingValue, envCol2Row2 + (envColWidthRow2 - shippingValueWidth) / 2, yPos + 7);

  yPos += 20;

  // Key Quality Benefits Section
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(42, 41, 99);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 56, 3, 3, 'D');
  
  yPos += 7;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Key Quality Benefits', margin + 5, yPos);
  
  yPos += 7;

  // Benefits list
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
    yPos += 4;
  });

  // ===== PAGE 3: CALL TO ACTION =====
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
    
    doc.text(
      `© ${new Date().getFullYear()} Buy American Veteran. All rights reserved.`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  return doc.output('arraybuffer') as Uint8Array;
}

