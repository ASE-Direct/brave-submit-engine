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
    oem_section: {
      unique_items: number;
      line_items: number;
      rd_tba_count: number;
      oem_only_count: number;
      total_oem_basket: number;
    };
    reman_section: {
      unique_items: number;
      line_items: number;
      total_reman_basket: number;
    };
    savings_breakdown: {
      oem_total_spend: number;
      bav_total_spend: number;
      total_savings: number;
      savings_percentage: number;
    };
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
  input_sku: string;  // Customer's input SKU (their product identifier)
  ase_sku: string | null;  // Our recommended ASE SKU
  total_quantity: number;
  total_current_cost: number;
  total_recommended_cost: number;
  total_savings: number;
  line_count: number;
}

/**
 * Helper to format currency with proper commas and decimals
 */
function formatCurrency(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
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

  // OEM SKUs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`OEM SKUs (${data.summary.oem_section.unique_items} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`(${data.summary.oem_section.line_items}) line items`, margin + 5, yPos);
  yPos += 5;
  doc.text(`(${data.summary.oem_section.rd_tba_count}) R&D TBA`, margin + 5, yPos);
  yPos += 5;
  doc.text(`(${data.summary.oem_section.oem_only_count}) OEM Only`, margin + 5, yPos);
  yPos += 5;
  doc.text(`$${formatCurrency(data.summary.oem_section.total_oem_basket)} OEM Mkt. basket`, margin + 5, yPos);
  
  yPos += 10;

  // Remanufactured SKUs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`Remanufactured SKUs (${data.summary.reman_section.unique_items} unique)`, margin, yPos);
  
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text(`(${data.summary.reman_section.line_items}) line items`, margin + 5, yPos);
  yPos += 5;
  doc.text(`$${formatCurrency(data.summary.reman_section.total_reman_basket)} Reman. Mkt. basket`, margin + 5, yPos);
  
  yPos += 15;

  // Savings Opportunity Breakdown
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text('Savings Opportunity Breakdown', margin, yPos);
  
  yPos += 10;

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
  doc.text(`$${formatCurrency(data.summary.savings_breakdown.oem_total_spend, 0)}`, col1X, yPos + 8);

  // BAV Total Spend
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  doc.text('BAV Total Spend', col2X, yPos);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`$${formatCurrency(data.summary.savings_breakdown.bav_total_spend, 0)}`, col2X, yPos + 8);

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
  doc.text(`$${formatCurrency(data.summary.savings_breakdown.total_savings, 0)}`, margin + 5, yPos + 10);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGreen);
  doc.text(`${formatCurrency(data.summary.savings_breakdown.savings_percentage, 1)}% savings`, pageWidth - margin - 40, yPos + 10);

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
  const co2Value = `${formatCurrency(data.summary.environmental.co2_reduced_pounds, 0)}`;
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
  const treesValue = `${formatCurrency(data.summary.environmental.trees_saved)}`;
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
  const plasticValue = `${formatCurrency(data.summary.environmental.plastic_reduced_pounds, 0)}`;
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
  const shippingValue = `${formatCurrency(data.summary.environmental.shipping_weight_saved_pounds || 0, 1)}`;
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
  doc.text('Aggregated by Customer Input SKU', margin, yPos + 6);
  
  yPos += 15;

  // Aggregate data by CUSTOMER'S INPUT SKU (not our ASE recommendation)
  const skuMap = new Map<string, SkuSummary>();
  
  data.breakdown.forEach(item => {
    // Use customer's input SKU as the key for aggregation
    const inputSku = item.current_product.sku || 'Unknown SKU';
    
    if (!skuMap.has(inputSku)) {
      skuMap.set(inputSku, {
        input_sku: inputSku,
        ase_sku: item.ase_sku || null,  // Track what we're recommending
        total_quantity: 0,
        total_current_cost: 0,
        total_recommended_cost: 0,
        total_savings: 0,
        line_count: 0
      });
    }
    
    const summary = skuMap.get(inputSku)!;
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
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  const colInputSku = margin + 2;
  const colAseSku = margin + 35;
  const colQty = margin + 68;
  const colCurrent = margin + 88;
  const colBav = margin + 117;
  const colSavings = margin + 146;
  
  doc.text('Input SKU', colInputSku, yPos + 5);
  doc.text('→ ASE SKU', colAseSku, yPos + 5);
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
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Input SKU', colInputSku, yPos + 5);
      doc.text('→ ASE SKU', colAseSku, yPos + 5);
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
    
    doc.setFontSize(7);
    // Show customer's input SKU
    doc.text(summary.input_sku.substring(0, 15), colInputSku, yPos + 5);
    // Show our recommended ASE SKU
    doc.text(summary.ase_sku ? summary.ase_sku.substring(0, 15) : 'N/A', colAseSku, yPos + 5);
    doc.text(summary.total_quantity.toString(), colQty, yPos + 5);
    doc.text(`$${formatCurrency(summary.total_current_cost)}`, colCurrent, yPos + 5);
    doc.text(`$${formatCurrency(summary.total_recommended_cost)}`, colBav, yPos + 5);
    
    // Highlight savings
    if (summary.total_savings > 0) {
      doc.setTextColor(brandRed);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(`$${formatCurrency(summary.total_savings)}`, colSavings, yPos + 5);
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
  
  // Table header - Compact horizontal layout
  doc.setFillColor(42, 41, 99);
  doc.rect(margin, yPos, contentWidth, 12, 'F');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  // Column positions (optimized for landscape-style data)
  const colOemSku = margin + 2;
  const colBavSku = margin + 28;
  const colQtyDetail = margin + 54;
  const colOemPrice = margin + 68;
  const colBavPrice = margin + 92;
  const colSavingsDetail = margin + 116;
  const colSavingsPct = margin + 142;
  const colProductName = margin + 162;
  
  // Multi-line header
  doc.text('OEM SKU', colOemSku, yPos + 4);
  doc.text('BAV SKU', colBavSku, yPos + 4);
  doc.text('Qty', colQtyDetail, yPos + 4);
  doc.text('OEM Price', colOemPrice, yPos + 4);
  doc.text('BAV Price', colBavPrice, yPos + 4);
  doc.text('Savings $', colSavingsDetail, yPos + 4);
  doc.text('Savings %', colSavingsPct, yPos + 4);
  
  // Second line of header for totals
  doc.setFontSize(6.5);
  doc.text('(Unit / Total)', colOemPrice, yPos + 8);
  doc.text('(Unit / Total)', colBavPrice, yPos + 8);
  
  yPos += 14;

  // Table rows
  let lineItemCount = 0;
  const maxLinesPerPage = 30;
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray);
  
  for (const item of itemsToShow) {
    if (lineItemCount > 0 && lineItemCount % maxLinesPerPage === 0) {
      doc.addPage();
      yPos = 20;
      
      // Repeat header
      doc.setFillColor(42, 41, 99);
      doc.rect(margin, yPos, contentWidth, 12, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('OEM SKU', colOemSku, yPos + 4);
      doc.text('BAV SKU', colBavSku, yPos + 4);
      doc.text('Qty', colQtyDetail, yPos + 4);
      doc.text('OEM Price', colOemPrice, yPos + 4);
      doc.text('BAV Price', colBavPrice, yPos + 4);
      doc.text('Savings $', colSavingsDetail, yPos + 4);
      doc.text('Savings %', colSavingsPct, yPos + 4);
      doc.setFontSize(6.5);
      doc.text('(Unit / Total)', colOemPrice, yPos + 8);
      doc.text('(Unit / Total)', colBavPrice, yPos + 8);
      yPos += 14;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray);
    }
    
    // Alternating row background
    const rowHeight = 12;
    if (lineItemCount % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
    }
    
    doc.setFontSize(6.5);
    
    // OEM SKU (current product SKU)
    const oemSku = item.current_product.sku.substring(0, 14);
    doc.text(oemSku, colOemSku, yPos + 4);
    
    // BAV SKU (recommended ASE SKU)
    const bavSku = item.ase_sku ? item.ase_sku.substring(0, 14) : 'N/A';
    doc.setFont('helvetica', 'bold');
    doc.text(bavSku, colBavSku, yPos + 4);
    doc.setFont('helvetica', 'normal');
    
    // Quantity
    doc.text(item.current_product.quantity.toString(), colQtyDetail, yPos + 4);
    
    // OEM Price (Unit / Total)
    const oemUnit = `$${formatCurrency(item.current_product.unit_price)}`;
    const oemTotal = `$${formatCurrency(item.current_product.total_cost)}`;
    doc.text(oemUnit, colOemPrice, yPos + 3);
    doc.setFontSize(6);
    doc.text(oemTotal, colOemPrice, yPos + 7);
    doc.setFontSize(6.5);
    
    // BAV Price (Unit / Total)
    if (item.recommended_product) {
      const bavUnit = `$${formatCurrency(item.recommended_product.unit_price)}`;
      const bavTotal = `$${formatCurrency(item.recommended_product.total_cost)}`;
      doc.text(bavUnit, colBavPrice, yPos + 3);
      doc.setFontSize(6);
      doc.text(bavTotal, colBavPrice, yPos + 7);
      doc.setFontSize(6.5);
    } else {
      doc.text('-', colBavPrice, yPos + 4);
    }
    
    // Savings $ (highlighted in red if positive)
    if (item.savings && item.savings.cost_savings > 0) {
      doc.setTextColor(brandRed);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${formatCurrency(item.savings.cost_savings)}`, colSavingsDetail, yPos + 4);
      doc.setTextColor(darkGray);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.text('-', colSavingsDetail, yPos + 4);
    }
    
    // Savings %
    if (item.savings && item.savings.cost_savings_percentage) {
      doc.setTextColor(brandGreen);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(item.savings.cost_savings_percentage, 1)}%`, colSavingsPct, yPos + 4);
      doc.setTextColor(darkGray);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.text('-', colSavingsPct, yPos + 4);
    }
    
    // Product Name (truncated for reference)
    doc.setFontSize(5.5);
    doc.setTextColor(102, 102, 102);
    const productName = item.current_product.name.substring(0, 35);
    doc.text(productName, colProductName, yPos + 4);
    doc.setTextColor(darkGray);
    doc.setFontSize(6.5);
    
    // Add match type indicator
    if (item.match_type === 'remanufactured') {
      doc.setFontSize(5);
      doc.setTextColor(brandGreen);
      doc.text('R', colBavSku + 20, yPos + 4);
      doc.setTextColor(darkGray);
      doc.setFontSize(6.5);
    }
    
    yPos += rowHeight;
    lineItemCount++;
  }
  
  // Add summary row at the end
  yPos += 3;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, contentWidth, 10, 'FD');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandNavy);
  doc.text(`Total Items: ${itemsToShow.length}`, colOemSku, yPos + 6);
  
  const totalSavings = itemsToShow.reduce((sum, item) => sum + (item.savings?.cost_savings || 0), 0);
  doc.setTextColor(brandRed);
  doc.text(`Total Savings: $${formatCurrency(totalSavings, 0)}`, colSavingsDetail - 10, yPos + 6);

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

