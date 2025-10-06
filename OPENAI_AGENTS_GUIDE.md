# OpenAI Agents SDK Implementation Guide

This guide provides detailed implementation instructions for using the OpenAI Agents SDK (also known as the Assistants API) in our document processing pipeline.

---

## 📚 Overview

We'll use OpenAI's **Assistants API v2** (Agents SDK) with the **Swarm pattern** for orchestrating multiple specialized agents. This provides:

- **Structured outputs** with function calling
- **Code interpreter** for data analysis
- **File handling** for Excel/CSV processing
- **Persistent threads** for conversation history
- **Function tools** for custom operations

---

## 🎯 Agent Architecture

### Multi-Agent Swarm Pattern

```
┌─────────────────────────────────────────────────────────┐
│              Orchestrator / Coordinator                  │
│                                                           │
│  Routes tasks to specialized agents based on current     │
│  processing step and maintains overall state             │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Parser     │  │   Matcher    │  │   Analyst    │
│    Agent     │  │    Agent     │  │    Agent     │
│              │  │              │  │              │
│ Extracts     │  │ Matches      │  │ Calculates   │
│ order data   │  │ products to  │  │ savings &    │
│ from files   │  │ catalog      │  │ generates    │
│              │  │              │  │ insights     │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔧 Setup & Configuration

### 1. Install Dependencies

```bash
npm install openai@^4.x
```

### 2. Environment Variables

Add to Supabase Edge Function secrets:

```bash
# Set in Supabase Dashboard under Edge Functions > Secrets
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-... # Optional
```

### 3. Import OpenAI SDK

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});
```

---

## 🤖 Agent Definitions

### Agent 1: Document Parser Agent

**Purpose:** Extract structured order data from Excel/CSV files

```typescript
// Create the parser assistant
async function createParserAgent() {
  const assistant = await openai.beta.assistants.create({
    name: "Document Parser Agent",
    model: "gpt-4o",
    instructions: `You are an expert at analyzing office supply purchase orders.

Your task is to extract order line items from Excel or CSV files.

For each item, extract:
- Product name (clean and normalize)
- SKU/Part number (if available)
- Quantity ordered
- Unit price
- Total price
- Any product specifications mentioned

Handle variations in:
- Column names (e.g., "Product", "Item", "Description")
- Data formats (different date/number formats)
- Missing data (make reasonable inferences)

Return data in structured JSON format.`,
    
    tools: [
      { type: "code_interpreter" }, // For parsing Excel/CSV
      {
        type: "function",
        function: {
          name: "extract_order_items",
          description: "Extract and structure order line items from parsed file data",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    sku: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    total_price: { type: "number" },
                    category_hint: { type: "string" }
                  },
                  required: ["product_name", "quantity"]
                }
              },
              total_items: { type: "number" },
              confidence: { type: "number", description: "0-1 confidence score" }
            },
            required: ["items", "total_items"]
          }
        }
      }
    ],
    
    temperature: 0.3, // Low temperature for consistent extraction
    response_format: { type: "json_object" }
  });
  
  return assistant;
}
```

### Agent 2: Product Matching Agent

**Purpose:** Match extracted items to master product catalog

```typescript
async function createMatchingAgent() {
  const assistant = await openai.beta.assistants.create({
    name: "Product Matching Agent",
    model: "gpt-4o",
    instructions: `You are an expert at matching office supply products across different catalogs and naming conventions.

Given a product description from a customer order, find the best match in our master catalog.

Consider:
- SKU variations (with/without dashes, different formats)
- Brand name variations (HP vs Hewlett-Packard)
- Model number variations (64 vs HP64 vs N9J90AN)
- Product name variations (Ink vs Ink Cartridge)
- Equivalent products from same manufacturer

Match confidence levels:
- 1.0 = Exact SKU match
- 0.9+ = Same SKU, different format
- 0.8+ = Same product, different naming
- 0.7+ = Equivalent product
- <0.7 = Uncertain match, needs review`,
    
    tools: [
      {
        type: "function",
        function: {
          name: "search_catalog",
          description: "Search the master product catalog",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              category: { type: "string", description: "Product category filter" },
              brand: { type: "string", description: "Brand filter" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_alternatives",
          description: "Find alternative or upgraded versions of a product",
          parameters: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              criteria: { 
                type: "array",
                items: { 
                  type: "string",
                  enum: ["larger_size", "bulk_option", "higher_yield", "eco_friendly"]
                }
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "report_match",
          description: "Report a product match result",
          parameters: {
            type: "object",
            properties: {
              customer_item: { type: "object" },
              matched_product: { type: "object" },
              confidence: { type: "number" },
              match_method: { 
                type: "string",
                enum: ["exact_sku", "fuzzy_name", "semantic", "ai_inference"]
              }
            },
            required: ["customer_item", "matched_product", "confidence"]
          }
        }
      }
    ],
    
    temperature: 0.2
  });
  
  return assistant;
}
```

### Agent 3: Savings Analysis Agent

**Purpose:** Calculate savings and generate recommendations

```typescript
async function createSavingsAgent() {
  const assistant = await openai.beta.assistants.create({
    name: "Savings Analysis Agent",
    model: "gpt-4o",
    instructions: `You are an expert cost analyst specializing in office supply optimization.

Analyze customer orders and recommend cost-saving opportunities.

Strategies to consider:
1. **Bulk Pricing:** Can customer save by reaching bulk quantity thresholds?
2. **Larger Sizes:** Would XL/XXL cartridges be more cost-effective?
3. **Page Yield:** Calculate cost-per-page, not just unit cost
4. **Alternative Products:** Find equivalent products with better pricing
5. **Consolidation:** Can similar items be consolidated?

Environmental Impact:
- Fewer cartridges = less plastic waste
- CO2 emissions per cartridge: ~2.5 lbs for ink, ~5 lbs for toner
- Larger cartridges = proportionally less packaging waste

Always explain savings clearly with specific numbers and percentages.`,
    
    tools: [
      {
        type: "function",
        function: {
          name: "calculate_cost_savings",
          description: "Calculate potential cost savings for a product switch",
          parameters: {
            type: "object",
            properties: {
              current_product: {
                type: "object",
                properties: {
                  sku: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  page_yield: { type: "number" }
                },
                required: ["quantity", "unit_price"]
              },
              recommended_product: {
                type: "object",
                properties: {
                  sku: { type: "string" },
                  unit_price: { type: "number" },
                  page_yield: { type: "number" },
                  bulk_price: { type: "number" },
                  bulk_minimum: { type: "number" }
                },
                required: ["unit_price"]
              }
            },
            required: ["current_product", "recommended_product"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calculate_environmental_impact",
          description: "Calculate environmental savings from product optimization",
          parameters: {
            type: "object",
            properties: {
              cartridges_reduced: { type: "number" },
              cartridge_type: { type: "string", enum: ["ink", "toner"] }
            },
            required: ["cartridges_reduced", "cartridge_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_recommendation",
          description: "Generate a savings recommendation",
          parameters: {
            type: "object",
            properties: {
              item_id: { type: "string" },
              recommendation_type: { 
                type: "string",
                enum: ["bulk_pricing", "larger_size", "alternative_product", "no_change"]
              },
              cost_savings: { type: "number" },
              environmental_savings: {
                type: "object",
                properties: {
                  cartridges_saved: { type: "number" },
                  co2_reduced: { type: "number" }
                }
              },
              explanation: { type: "string" }
            },
            required: ["item_id", "recommendation_type", "explanation"]
          }
        }
      }
    ],
    
    temperature: 0.4
  });
  
  return assistant;
}
```

---

## 🔄 Agent Orchestration

### Orchestrator Implementation

```typescript
interface AgentContext {
  submission_id: string;
  processing_job_id: string;
  file_url: string;
  current_step: string;
  data: {
    extracted_items?: any[];
    matched_products?: any[];
    savings_analysis?: any;
  };
}

class AgentOrchestrator {
  private openai: OpenAI;
  private agents: {
    parser: string;    // Assistant ID
    matcher: string;
    analyst: string;
  };
  
  constructor(openai: OpenAI) {
    this.openai = openai;
    this.agents = {
      parser: Deno.env.get('PARSER_AGENT_ID')!,
      matcher: Deno.env.get('MATCHER_AGENT_ID')!,
      analyst: Deno.env.get('ANALYST_AGENT_ID')!
    };
  }
  
  async processDocument(context: AgentContext): Promise<void> {
    // Create a thread for this processing job
    const thread = await this.openai.beta.threads.create({
      metadata: {
        submission_id: context.submission_id,
        processing_job_id: context.processing_job_id
      }
    });
    
    try {
      // Step 1: Parse document
      await this.updateProgress(context.processing_job_id, 10, "Parsing document...");
      const extractedData = await this.runParserAgent(thread.id, context.file_url);
      context.data.extracted_items = extractedData.items;
      
      // Step 2: Match products
      await this.updateProgress(context.processing_job_id, 40, "Matching products...");
      const matches = await this.runMatchingAgent(thread.id, extractedData.items);
      context.data.matched_products = matches;
      
      // Step 3: Analyze savings
      await this.updateProgress(context.processing_job_id, 70, "Analyzing savings...");
      const analysis = await this.runSavingsAgent(thread.id, matches);
      context.data.savings_analysis = analysis;
      
      // Step 4: Generate report (separate function)
      await this.updateProgress(context.processing_job_id, 90, "Generating report...");
      const reportUrl = await this.generateReport(context);
      
      // Complete
      await this.updateProgress(context.processing_job_id, 100, "Complete", {
        status: 'completed',
        report_url: reportUrl
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      await this.updateProgress(context.processing_job_id, 0, "Failed", {
        status: 'failed',
        error_message: error.message
      });
      throw error;
    }
  }
  
  private async runParserAgent(threadId: string, fileUrl: string) {
    // Upload file to OpenAI
    const fileResponse = await fetch(fileUrl);
    const fileBuffer = await fileResponse.arrayBuffer();
    const file = await this.openai.files.create({
      file: new File([fileBuffer], 'order.xlsx'),
      purpose: 'assistants'
    });
    
    // Add message to thread
    await this.openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: "Please parse this purchase order file and extract all line items.",
      attachments: [{ file_id: file.id, tools: [{ type: "code_interpreter" }] }]
    });
    
    // Run the parser agent
    const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: this.agents.parser
    });
    
    if (run.status === 'completed') {
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      // Extract function call results
      if (lastMessage.content[0].type === 'text') {
        const extractedData = JSON.parse(lastMessage.content[0].text.value);
        return extractedData;
      }
    }
    
    throw new Error('Parser agent failed');
  }
  
  private async runMatchingAgent(threadId: string, items: any[]) {
    const matches = [];
    
    for (const item of items) {
      await this.openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: `Find the best match for this product: ${JSON.stringify(item)}`
      });
      
      const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.agents.matcher,
        tools: [
          {
            type: "function",
            function: this.createSearchCatalogFunction()
          }
        ]
      });
      
      // Handle function calls
      if (run.status === 'requires_action') {
        const toolCalls = run.required_action?.submit_tool_outputs.tool_calls || [];
        const toolOutputs = await this.handleToolCalls(toolCalls);
        
        await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: toolOutputs
        });
      }
      
      // Get the match result
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const matchResult = this.extractMatchResult(messages.data[0]);
      matches.push(matchResult);
    }
    
    return matches;
  }
  
  private async runSavingsAgent(threadId: string, matches: any[]) {
    await this.openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: `Analyze these matched products and generate savings recommendations: ${JSON.stringify(matches)}`
    });
    
    const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: this.agents.analyst
    });
    
    // Process function calls for calculations
    if (run.status === 'requires_action') {
      const toolCalls = run.required_action?.submit_tool_outputs.tool_calls || [];
      const toolOutputs = await this.handleToolCalls(toolCalls);
      
      await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
        tool_outputs: toolOutputs
      });
    }
    
    // Get the analysis result
    const messages = await this.openai.beta.threads.messages.list(threadId);
    const analysis = JSON.parse(messages.data[0].content[0].text.value);
    
    return analysis;
  }
  
  private async handleToolCalls(toolCalls: any[]): Promise<any[]> {
    const outputs = [];
    
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      let result;
      switch (functionName) {
        case 'search_catalog':
          result = await this.searchCatalog(args);
          break;
        case 'find_alternatives':
          result = await this.findAlternatives(args);
          break;
        case 'calculate_cost_savings':
          result = this.calculateCostSavings(args);
          break;
        case 'calculate_environmental_impact':
          result = this.calculateEnvironmentalImpact(args);
          break;
        default:
          result = { error: 'Unknown function' };
      }
      
      outputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify(result)
      });
    }
    
    return outputs;
  }
  
  private async searchCatalog(args: any) {
    // Search master_products table
    const { data } = await supabase
      .from('master_products')
      .select('*')
      .textSearch('search_vector', args.query)
      .limit(5);
    
    return data;
  }
  
  private async findAlternatives(args: any) {
    // Find alternative products
    const { data } = await supabase
      .from('master_products')
      .select('*')
      .contains('alternative_product_ids', [args.product_id]);
    
    return data;
  }
  
  private calculateCostSavings(args: any) {
    const current = args.current_product;
    const recommended = args.recommended_product;
    
    const currentTotal = current.quantity * current.unit_price;
    
    // Calculate recommended quantity based on page yield
    let recommendedQty = current.quantity;
    if (current.page_yield && recommended.page_yield) {
      recommendedQty = Math.ceil(
        (current.quantity * current.page_yield) / recommended.page_yield
      );
    }
    
    // Check for bulk pricing
    const usesBulkPrice = recommendedQty >= (recommended.bulk_minimum || Infinity);
    const effectivePrice = usesBulkPrice ? recommended.bulk_price : recommended.unit_price;
    
    const recommendedTotal = recommendedQty * effectivePrice;
    const savings = currentTotal - recommendedTotal;
    
    return {
      current_cost: currentTotal,
      recommended_cost: recommendedTotal,
      cost_savings: savings,
      savings_percentage: (savings / currentTotal) * 100,
      recommended_quantity: recommendedQty,
      bulk_pricing_applied: usesBulkPrice
    };
  }
  
  private calculateEnvironmentalImpact(args: any) {
    const cartridgesReduced = args.cartridges_reduced;
    const co2PerCartridge = args.cartridge_type === 'toner' ? 5.2 : 2.5;
    
    const co2Reduced = cartridgesReduced * co2PerCartridge;
    const treesEquivalent = co2Reduced / 48; // 1 tree absorbs ~48 lbs CO2/year
    const plasticReduced = cartridgesReduced * 0.5; // ~0.5 lbs plastic per cartridge
    
    return {
      cartridges_saved: cartridgesReduced,
      co2_reduced_pounds: co2Reduced,
      trees_equivalent: treesEquivalent,
      plastic_reduced_pounds: plasticReduced
    };
  }
  
  private async updateProgress(jobId: string, progress: number, step: string, updates: any = {}) {
    await supabase
      .from('processing_jobs')
      .update({
        progress,
        current_step: step,
        updated_at: new Date().toISOString(),
        ...updates
      })
      .eq('id', jobId);
  }
}
```

---

## 🚀 Usage in Edge Function

### Main Processing Function

```typescript
// supabase/functions/process-document/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const { submissionId } = await req.json();
    
    // Get submission details
    const { data: submission } = await supabase
      .from('document_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();
    
    // Create processing job
    const { data: job } = await supabase
      .from('processing_jobs')
      .insert({
        submission_id: submissionId,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // Start background processing
    const orchestrator = new AgentOrchestrator(openai);
    
    // Run async (don't await in Edge Function)
    orchestrator.processDocument({
      submission_id: submissionId,
      processing_job_id: job.id,
      file_url: submission.file_url,
      current_step: 'initializing',
      data: {}
    }).catch(console.error);
    
    return new Response(JSON.stringify({
      success: true,
      processing_job_id: job.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

---

## 💡 Best Practices

### 1. Agent Initialization
- Create agents once and reuse assistant IDs
- Store assistant IDs in environment variables
- Update agents via API when prompts change

### 2. Cost Optimization
- Use `gpt-4o-mini` for simpler tasks (matching)
- Use `gpt-4o` for complex analysis
- Cache catalog data to reduce function calls
- Batch similar operations

### 3. Error Handling
- Implement retry logic for API failures
- Store partial results for resume capability
- Log all agent interactions for debugging

### 4. Testing
- Test each agent independently
- Create test threads with known data
- Monitor token usage and costs
- Track accuracy of matches and calculations

---

## 📊 Performance Metrics

Expected performance for typical 20-item order:

- **Parsing:** 10-15 seconds
- **Matching:** 20-30 seconds (1-2s per item)
- **Analysis:** 15-20 seconds
- **Report Gen:** 10-15 seconds
- **Total:** ~60-80 seconds

Token usage estimate:
- Input tokens: ~5,000
- Output tokens: ~3,000
- **Total cost:** ~$0.15-0.25 per document

---

## 🔍 Debugging

### View Thread Messages

```typescript
async function debugThread(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);
  
  for (const message of messages.data) {
    console.log(`${message.role}:`, message.content);
  }
}
```

### Monitor Run Status

```typescript
async function monitorRun(threadId: string, runId: string) {
  let run = await openai.beta.threads.runs.retrieve(threadId, runId);
  
  while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
    console.log('Status:', run.status);
    await new Promise(resolve => setTimeout(resolve, 1000));
    run = await openai.beta.threads.runs.retrieve(threadId, runId);
  }
  
  console.log('Final status:', run.status);
  return run;
}
```

---

This guide provides everything needed to implement the OpenAI Agents SDK in your document processing pipeline. The agents work together in a coordinated workflow to provide accurate, cost-effective product matching and savings analysis.

