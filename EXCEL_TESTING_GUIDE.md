# Excel Processing - Quick Testing Guide

## ✅ What's Now Supported

Your system can now accurately process:
- ✅ `.xlsx` (Excel 2007+)
- ✅ `.xls` (Excel 97-2003)
- ✅ `.csv` (Comma-separated values)

## 🧪 How to Test

### 1. **Test with Sample Excel Files**

You already have sample Excel files in your `sample-data/` folder:

```
sample-data/
  ├── 53 Toner.xlsx - Sheet1.csv
  ├── Item Usage Submitted - Toner Report - 2.1.25-8.27.25.xlsx - All Toner Orders.csv
  └── Surgery Partners 2023 item usage staples pricing.xlsx - Sheet1.csv
```

**Note:** These appear to be CSVs exported from Excel. For true Excel testing, you'll need actual `.xlsx` files.

### 2. **Create a Test Excel File**

Create a simple Excel file with this structure:

| Item Description | OEM Number | Qty | Price |
|-----------------|------------|-----|-------|
| HP 410A Black Toner | CF410A | 5 | 89.99 |
| Brother TN660 High Yield | TN660 | 10 | 45.50 |
| Canon 046 Cyan | 1249C001 | 3 | 65.00 |

Save as `test-order.xlsx`

### 3. **Upload and Process**

1. Go to your app: `http://localhost:5173` (or production URL)
2. Fill out the form
3. Upload the Excel file
4. Complete reCAPTCHA
5. Submit
6. Watch the processing animation
7. Review the results

### 4. **Check Logs**

Monitor Supabase Edge Function logs:

```bash
supabase functions logs process-document --tail
```

Look for:
```
📊 Parsing Excel file...
📊 Reading sheet: Sheet1
✓ Found data header at row 1
📊 Columns: [Item Description, OEM Number, Qty, Price]
📊 Total data rows: 3
✅ Parsed 3 items from 3 rows
```

## 🔍 What to Verify

### Successful Processing Should Show:

1. **File Detection**
   ```
   📄 Parsing document: test-order.xlsx
   📊 Parsing Excel file...
   ```

2. **Sheet Reading**
   ```
   📊 Reading sheet: Sheet1
   ```

3. **Header Detection**
   ```
   ✓ Found data header at row 1
   📊 Columns: [Item Description, OEM Number, Qty, Price]
   ```

4. **Product Extraction**
   ```
   ✅ Parsed 3 items from 3 rows
   ```

5. **Product Matching**
   ```
   🔍 Matching 3 products...
   ✓ Matched via SKU: CF410A
   ✓ Matched via SKU: TN660
   ✓ Matched via full-text search
   ✅ Chunk complete: 3/3 matched (100%)
   ```

6. **Savings Calculation**
   ```
   💰 Calculating savings...
   📊 Analyzing: HP 410A Black Toner
   💰 Savings: $15.25 (17.0%)
   ```

## 🐛 Troubleshooting

### Issue: "Failed to parse file"

**Possible causes:**
- File is corrupted
- Wrong file format
- Empty worksheet

**Solution:**
- Check file opens in Excel
- Verify file extension
- Ensure worksheet has data

### Issue: "No items extracted"

**Possible causes:**
- Headers not detected
- All rows are blank
- Column names don't match patterns

**Solution:**
- Check logs for header detection message
- Verify Excel has standard column names (Product, SKU, Qty, Price, etc.)
- Add debugging to see what columns were found

### Issue: "Products not matching"

**Possible causes:**
- SKUs don't exist in master catalog
- Product names too different
- Master catalog empty

**Solution:**
- Verify master catalog has products
- Check SKU values against master_products table
- Review matching tier logs

## 📊 Testing Different Excel Formats

### Test Case 1: Clean Excel File
```
Row 1: [Product, SKU, Quantity, Price]
Row 2: [HP Toner, CF410A, 5, 89.99]
Row 3: [Brother Toner, TN660, 10, 45.50]
```
✅ Should work perfectly

### Test Case 2: Excel with Metadata
```
Row 1: [Company Name]
Row 2: [Order Date: 2025-01-15]
Row 3: []
Row 4: [Item Description, OEM Number, Qty, Sale]
Row 5: [HP Toner, CF410A, 5, 89.99]
```
✅ Smart header detection should find row 4

### Test Case 3: Multiple SKU Columns
```
Row 1: [Product, Staples SKU, OEM Number, Qty, Price]
Row 2: [HP Toner, 123456, CF410A, 5, 89.99]
```
✅ Should try both SKUs, prefer OEM

### Test Case 4: Large File
```
500+ rows of products
```
✅ Chunked processing (200 per chunk)

## 🚀 Deploy to Production

Once local testing is successful:

```bash
# Deploy the updated function
supabase functions deploy process-document

# Verify deployment
supabase functions list
```

## 📝 Test Checklist

- [ ] Upload .xlsx file
- [ ] Upload .xls file
- [ ] Upload .csv file
- [ ] Test file with metadata rows
- [ ] Test file with multiple SKU columns
- [ ] Test large file (200+ rows)
- [ ] Verify all products matched
- [ ] Check savings calculations
- [ ] Download PDF report
- [ ] Check processing logs
- [ ] Verify data in database tables

## 🎯 Expected Results

After processing a test Excel file:

1. **processing_jobs table**: Status = 'completed', Progress = 100
2. **order_items_extracted table**: All rows inserted with matched products
3. **savings_reports table**: Report generated with totals
4. **Storage**: PDF report uploaded
5. **Frontend**: Results page shows savings

## 📞 Need Help?

If Excel processing isn't working:

1. Check Edge Function logs: `supabase functions logs process-document`
2. Check browser console for errors
3. Verify file structure matches expected format
4. Test with a simple 2-3 row Excel file first
5. Ensure master_products table has data

---

**Implementation Status**: ✅ Complete and Ready for Testing
