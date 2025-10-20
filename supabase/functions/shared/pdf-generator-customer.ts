/**
 * Customer-Facing PDF Report Generator
 * 
 * Generates simplified 4-page PDF reports for customers
 * - Page 1: Executive Summary with SKU breakdown
 * - Page 2: Environmental Impact & Key Benefits
 * - Page 3: W9 Form
 * - Page 4: Contact/CTA
 */

import { jsPDF } from 'npm:jspdf@2.5.2';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { BAV_LOGO_BASE64 } from './logoData.ts';
import { W9_PDF_BASE64 } from './w9Data.ts';

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

  // OEM SKUs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`OEM SKUs (${data.summary.oem_section.unique_items} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const oemLines = [
    `(${data.summary.oem_section.line_items}) line items`,
    `(${data.summary.oem_section.rd_tba_count}) R&D TBA`,
    `(${data.summary.oem_section.oem_only_count}) OEM Only`,
    `$${data.summary.oem_section.total_oem_basket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} OEM Mkt. basket`
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
  doc.text(`Remanufactured SKUs (${data.summary.reman_section.unique_items} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const remanLines = [
    `(${data.summary.reman_section.line_items}) line items`,
    `$${data.summary.reman_section.total_reman_basket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Reman. Mkt. basket`
  ];
  
  remanLines.forEach(line => {
    doc.text(line, margin + 5, yPos);
    yPos += 5;
  });
  
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

  // User's Current Spend
  doc.setFontSize(10);
  doc.setTextColor(darkGray);
  doc.setFont('helvetica', 'normal');
  doc.text("User's Current Spend", col1X, yPos);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`$${data.summary.savings_breakdown.oem_total_spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, col1X, yPos + 8);

  // BAV Total Spend
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('BAV Total Spend', col2X, yPos);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`$${data.summary.savings_breakdown.bav_total_spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, col2X, yPos + 8);

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
  doc.text(`$${data.summary.savings_breakdown.total_savings.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, margin + 5, yPos + 10);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGreen);
  doc.text(`${data.summary.savings_breakdown.savings_percentage.toFixed(1)}% savings`, pageWidth - margin - 40, yPos + 10);

  // ===== PAGE 2: ENVIRONMENTAL IMPACT & KEY BENEFITS =====
  doc.addPage();
  yPos = 20;

  // Page Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Your Impact', margin, yPos);
  yPos += 12;

  // Environmental Impact Section - Vertical Stacked Layout
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.8);
  const envBoxHeight = 95;
  doc.roundedRect(margin, yPos, contentWidth, envBoxHeight, 3, 3, 'FD');
  
  yPos += 10;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text('🌍 Environmental Impact', margin + 5, yPos);
  
  yPos += 12;

  // Environmental metrics - Vertical stacked layout with better spacing
  const metricLeftCol = margin + 10;
  const metricSpacing = 15;

  // Metric 1: Cartridges Saved
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray);
  doc.text('Cartridges Saved from Landfill', metricLeftCol, yPos);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(`${data.summary.environmental.cartridges_saved}`, metricLeftCol, yPos + 8);
  yPos += metricSpacing;

  // Metric 2: CO2 Reduced
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray);
  doc.text('CO₂ Emissions Reduced', metricLeftCol, yPos);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(`${data.summary.environmental.co2_reduced_pounds.toFixed(0)} lbs`, metricLeftCol, yPos + 8);
  yPos += metricSpacing;

  // Metric 3: Trees Equivalent
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray);
  doc.text('Trees Saved Equivalent', metricLeftCol, yPos);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(`${data.summary.environmental.trees_saved.toFixed(2)} trees`, metricLeftCol, yPos + 8);
  yPos += metricSpacing;

  // Metric 4: Plastic Reduced
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray);
  doc.text('Plastic Waste Reduced', metricLeftCol, yPos);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(`${data.summary.environmental.plastic_reduced_pounds.toFixed(0)} lbs`, metricLeftCol, yPos + 8);
  yPos += metricSpacing;

  // Metric 5: Shipping Weight Saved
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray);
  doc.text('Shipping Weight Saved', metricLeftCol, yPos);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(`${(data.summary.environmental.shipping_weight_saved_pounds || 0).toFixed(1)} lbs`, metricLeftCol, yPos + 8);
  
  yPos += 22;

  // Key Quality Benefits Section - Enhanced and larger
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(42, 41, 99);
  doc.setLineWidth(0.8);
  const benefitsBoxHeight = 85;
  doc.roundedRect(margin, yPos, contentWidth, benefitsBoxHeight, 3, 3, 'D');
  
  yPos += 10;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('✓ Key Quality Benefits', margin + 5, yPos);
  
  yPos += 10;

  // Benefits list - Enhanced with better spacing and larger text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const benefits = [
    '2-Year Warranty Guarantee',
    'STMC & ISO Certified - Performance, yield, and reliability tested',
    'Independent Lab Tested - Validated by Buyer\'s Lab for quality',
    'Green Choice - Reduces landfill waste by 50%',
    'World\'s Largest Cartridge Recycler - OEM-Equivalent, EcoLabel Certified',
    'Tariff-Free - Avoid hidden import fees',
    'Fast Delivery - 2-day shipping available',
    'Veteran-Owned - 5% donated to U.S. Military Veteran support'
  ];
  
  benefits.forEach((benefit) => {
    // Checkmark icon instead of bullet
    doc.setTextColor(34, 197, 94);
    doc.setFont('helvetica', 'bold');
    doc.text('✓', margin + 8, yPos);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray);
    const benefitLines = doc.splitTextToSize(benefit, contentWidth - 20);
    benefitLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 14, yPos);
      if (idx < benefitLines.length - 1) yPos += 4.5;
    });
    yPos += 5.5;
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

  // Footer on all pages (temporary - will be updated after merging with W9)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(darkGray);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BAV Savings Challenge Report | Page ${i}`,
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

  // Generate the base PDF
  const basePdfBytes = doc.output('arraybuffer') as Uint8Array;

  // Now merge with W9 PDF using pdf-lib
  try {
    // Load the generated PDF
    const pdfDoc = await PDFDocument.load(basePdfBytes);
    
    // Decode the W9 PDF from base64
    const w9Bytes = Uint8Array.from(atob(W9_PDF_BASE64), c => c.charCodeAt(0));
    const w9Doc = await PDFDocument.load(w9Bytes);
    
    // Get all W9 pages (in case it's multi-page)
    const w9PageCount = w9Doc.getPageCount();
    const w9Pages = await pdfDoc.copyPages(w9Doc, Array.from({ length: w9PageCount }, (_, i) => i));
    
    // Insert W9 pages before the last page (which is the contact page)
    // Current pages: 0 (Summary), 1 (Environmental), 2 (Contact)
    // We want: 0 (Summary), 1 (Environmental), 2+ (W9 pages), last (Contact)
    w9Pages.forEach((w9Page, index) => {
      pdfDoc.insertPage(2 + index, w9Page);
    });
    
    // Save the merged PDF
    const mergedPdfBytes = await pdfDoc.save();
    return new Uint8Array(mergedPdfBytes);
    
  } catch (error) {
    console.error('Failed to merge W9 PDF:', error);
    console.error('Error details:', error);
    // If merging fails, return the original PDF without W9
    return basePdfBytes;
  }
}

