/**
 * Internal PDF Report Generator
 * 
 * Generates detailed internal reports for sales team
 * - Page 1: Executive Summary with SKU breakdown
 * - Page 2: Environmental Impact & Key Benefits
 * - Page 3+: SKU Summary Report (aggregated by unique ASE SKU)
 * - Following pages: Full line item details (simplified)
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
      cost_savings_percentage: number;
    };
    reason?: string;
  }>;
}

interface SkuSummary {
  ase_sku: string;
  total_quantity: number;
  total_current_cost: number;
  total_recommended_cost: number;
  total_savings: number;
  line_count: number;
}

/**
 * Generate internal PDF report with SKU summary and line items
 */
export async function generateInternalPDFReport(data: ReportData): Promise<Uint8Array> {
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

  // ===== PAGE 1: EXECUTIVE SUMMARY ONLY =====

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
  doc.text('Internal Savings Report', margin, yPos);
  
  yPos += 12;

  // Customer info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`Customer: ${data.customer.firstName} ${data.customer.lastName}`, margin, yPos);
  yPos += 6;
  doc.text(`Company: ${data.customer.company}`, margin, yPos);
  yPos += 6;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, yPos);
  
  yPos += 15;

  // Divider
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

  // OEM SKUs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`OEM SKUs (${uniqueSkus.size} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`(${data.summary.total_items}) line items`, margin + 5, yPos);
  yPos += 5;
  doc.text(`$${data.summary.total_current_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} OEM Mkt. basket`, margin + 5, yPos);
  
  yPos += 10;

  // Remanufactured SKUs
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`Remanufactured SKUs (${data.summary.remanufactured_count || 0} unique)`, margin, yPos);
  
  yPos += 8;
  
  const remanItems = data.breakdown.filter(item => item.match_type === 'remanufactured');
  const remanLineCount = remanItems.length;
  const remanTotalCost = remanItems.reduce((sum, item) => sum + (item.recommended_product?.total_cost || 0), 0);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`(${remanLineCount}) line items`, margin + 5, yPos);
  yPos += 5;
  doc.text(`$${remanTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Reman. Mkt. basket`, margin + 5, yPos);
  
  yPos += 10;

  // OEM Like Kind Exchange
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`OEM Like Kind Exchange (${data.summary.oem_count || 0} unique)`, margin, yPos);
  
  yPos += 10;

  // No Match
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`No Match OEM (${data.summary.no_match_count || 0} items) - TBD`, margin, yPos);
  
  yPos += 15;

  // Savings Opportunity Breakdown
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Savings Opportunity Breakdown', margin, yPos);
  
  yPos += 10;

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

  // Total Savings
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
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

  // ===== PAGE 2: ENVIRONMENTAL & BENEFITS =====
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

  // Environmental metrics
  const envCol1 = margin + 5;
  const envCol2 = margin + contentWidth / 3;
  const envCol3 = margin + (contentWidth * 2 / 3);
  const envColWidth = contentWidth / 3;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const cartridgesSavedLabel = 'Cartridges Saved';
  const cartridgesSavedLabelWidth = doc.getTextWidth(cartridgesSavedLabel);
  doc.text(cartridgesSavedLabel, envCol1 + (envColWidth - cartridgesSavedLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  const cartridgesSavedValue = `${data.summary.environmental.cartridges_saved}`;
  const cartridgesSavedValueWidth = doc.getTextWidth(cartridgesSavedValue);
  doc.text(cartridgesSavedValue, envCol1 + (envColWidth - cartridgesSavedValueWidth) / 2, yPos + 7);
  
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

  // Row 2
  const envCol1Row2 = margin + 5;
  const envCol2Row2 = margin + contentWidth / 2;
  const envColWidthRow2 = contentWidth / 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  const plasticLabel = 'Plastic Reduced (lbs)';
  const plasticLabelWidth = doc.getTextWidth(plasticLabel);
  doc.text(plasticLabel, envCol1Row2 + (envColWidthRow2 - plasticLabelWidth) / 2, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  const plasticValue = `${data.summary.environmental.plastic_reduced_pounds.toFixed(0)}`;
  const plasticValueWidth = doc.getTextWidth(plasticValue);
  doc.text(plasticValue, envCol1Row2 + (envColWidthRow2 - plasticValueWidth) / 2, yPos + 7);
  
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

  // Key Benefits
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

  // ===== PAGE 3+: SKU SUMMARY REPORT =====
  doc.addPage();
  yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('SKU Summary Report', margin, yPos);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Aggregated by Unique ASE SKU', margin, yPos + 6);
  
  yPos += 15;

  // Aggregate data by SKU
  const skuMap = new Map<string, SkuSummary>();
  
  data.breakdown.forEach(item => {
    const sku = item.ase_sku || 'TBD';
    
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        ase_sku: sku,
        total_quantity: 0,
        total_current_cost: 0,
        total_recommended_cost: 0,
        total_savings: 0,
        line_count: 0
      });
    }
    
    const summary = skuMap.get(sku)!;
    summary.line_count++;
    summary.total_quantity += item.current_product.quantity;
    summary.total_current_cost += item.current_product.total_cost;
    summary.total_recommended_cost += item.recommended_product?.total_cost || item.current_product.total_cost;
    summary.total_savings += item.savings?.cost_savings || 0;
  });

  // Convert to array and sort by savings (highest first)
  const skuSummaries = Array.from(skuMap.values()).sort((a, b) => b.total_savings - a.total_savings);

  // Table header
  doc.setFillColor(42, 41, 99);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  const colSku = margin + 2;
  const colQty = margin + 45;
  const colCurrent = margin + 70;
  const colBav = margin + 105;
  const colSavings = margin + 140;
  
  doc.text('ASE SKU', colSku, yPos + 5);
  doc.text('Qty', colQty, yPos + 5);
  doc.text('Current $', colCurrent, yPos + 5);
  doc.text('BAV $', colBav, yPos + 5);
  doc.text('Savings $', colSavings, yPos + 5);
  
  yPos += 10;

  // Table rows
  let rowCount = 0;
  const maxRowsPerPage = 25;
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  skuSummaries.forEach((summary) => {
    if (rowCount > 0 && rowCount % maxRowsPerPage === 0) {
      doc.addPage();
      yPos = 20;
      
      // Repeat header
      doc.setFillColor(42, 41, 99);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('ASE SKU', colSku, yPos + 5);
      doc.text('Qty', colQty, yPos + 5);
      doc.text('Current $', colCurrent, yPos + 5);
      doc.text('BAV $', colBav, yPos + 5);
      doc.text('Savings $', colSavings, yPos + 5);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray);
    }
    
    // Alternating row background
    if (rowCount % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos, contentWidth, 7, 'F');
    }
    
    doc.setFontSize(8);
    doc.text(summary.ase_sku.substring(0, 20), colSku, yPos + 5);
    doc.text(summary.total_quantity.toString(), colQty, yPos + 5);
    doc.text(`$${summary.total_current_cost.toFixed(2)}`, colCurrent, yPos + 5);
    doc.text(`$${summary.total_recommended_cost.toFixed(2)}`, colBav, yPos + 5);
    
    // Highlight savings
    if (summary.total_savings > 0) {
      doc.setTextColor(brandRed);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(`$${summary.total_savings.toFixed(2)}`, colSavings, yPos + 5);
    doc.setTextColor(darkGray);
    doc.setFont('helvetica', 'normal');
    
    yPos += 7;
    rowCount++;
  });

  // ===== FULL LINE ITEM DETAILS =====
  doc.addPage();
  yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Full Line Item Details', margin, yPos);
  
  yPos += 12;

  // Show items with recommendations
  const itemsToShow = data.breakdown.filter(item => item.recommended_product);
  
  let itemCount = 0;
  const maxItemsPerPage = 3;

  for (const item of itemsToShow) {
    if (itemCount > 0 && itemCount % maxItemsPerPage === 0) {
      doc.addPage();
      yPos = 20;
    }

    const boxHeight = 55;
    const boxStartY = yPos;
    
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'F');
    
    yPos += 8;

    // Current Product - KEEP name/description for reference
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandNavy);
    doc.text('Current:', margin + 3, yPos);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray);
    
    const currentName = doc.splitTextToSize(item.current_product.name, contentWidth - 10);
    doc.text(currentName[0], margin + 3, yPos + 5);
    
    const currentPriceText = `${item.current_product.quantity} × $${item.current_product.unit_price.toFixed(2)} = $${item.current_product.total_cost.toFixed(2)}`;
    doc.text(currentPriceText, margin + 3, yPos + 9);

    yPos += 14;

    // Recommended Product - ONLY show ASE SKU
    if (item.recommended_product) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(brandRed);
      doc.text('Recommended:', margin + 3, yPos);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray);
      
      const aseSku = item.ase_sku || 'TBD';
      doc.text(`SKU: ${aseSku}`, margin + 3, yPos + 5);
      
      const recPriceText = `${item.recommended_product.quantity_needed} × $${item.recommended_product.unit_price.toFixed(2)} = $${item.recommended_product.total_cost.toFixed(2)}`;
      doc.text(recPriceText, margin + 3, yPos + 9);
    }

    yPos += 14;

    // Savings badge
    if (item.savings && item.savings.cost_savings > 0) {
      const savingsX = pageWidth - margin - 42;
      const savingsY = boxStartY + 5;
      
      doc.setFillColor(192, 0, 0);
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
      doc.text(reasonText[0], margin + 3, yPos);
    }

    yPos += 10;
    itemCount++;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(darkGray);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BAV Internal Report | Page ${i} of ${totalPages} | CONFIDENTIAL`,
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

