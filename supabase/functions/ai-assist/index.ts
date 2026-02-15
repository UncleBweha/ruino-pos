import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "categorize_customer": {
        systemPrompt =
          "You are a retail business assistant for a general merchant shop in Kenya. Analyze customer data and suggest a category.";
        userPrompt = `Based on this customer data, suggest a category (retail, wholesale, loyal, occasional) and a short reason.
Customer: ${data.name}
Phone: ${data.phone || "N/A"}
Business: ${data.business_name || "N/A"}
Location: ${data.location || "N/A"}
Total purchases: ${data.total_purchases || 0}
Total spent: KES ${data.total_spent || 0}
Respond in JSON: {"category": "...", "reason": "..."}`;
        break;
      }
      case "credit_eligibility": {
        systemPrompt =
          "You are a retail credit risk assessor for a general merchant shop in Kenya.";
        userPrompt = `Assess credit eligibility for this customer:
Name: ${data.name}
Total purchases: ${data.total_purchases || 0}
Total spent: KES ${data.total_spent || 0}
Outstanding credit: KES ${data.outstanding_credit || 0}
Payment history: ${data.payment_history || "No history"}
Respond in JSON: {"eligible": true/false, "limit": number, "reason": "..."}`;
        break;
      }
      case "supplier_insights": {
        systemPrompt =
          "You are a supply chain analyst for a general merchant shop in Kenya.";
        userPrompt = `Analyze this supplier's data and provide insights:
Supplier: ${data.name}
Payment terms: ${data.payment_terms} days
Total supplies: ${data.total_supplies}
Unpaid amount: KES ${data.unpaid_amount || 0}
Average delivery time: ${data.avg_delivery || "Unknown"}
Late payments: ${data.late_payments || 0}
Respond in JSON: {"insights": ["...", "..."], "recommendations": ["...", "..."], "risk_level": "low/medium/high"}`;
        break;
      }
      case "invoice_notes": {
        systemPrompt =
          "You are a professional invoice writer for a general merchant business in Kenya.";
        userPrompt = `Generate professional invoice notes and payment terms for:
Type: ${data.type}
Customer: ${data.customer_name}
Total: KES ${data.total}
Items: ${data.item_count} items
Respond in JSON: {"notes": "...", "payment_terms": "..."}`;
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
    } catch {
      parsed = { raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
