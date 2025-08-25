import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { capsuleId, question, userApiKey } = await request.json();

    if (!capsuleId || !question) {
      return NextResponse.json({ error: 'capsuleId and question are required' }, { status: 400 });
    }

    // Use user's API key if provided, otherwise fall back to default
    const API_KEY = userApiKey || process.env.SHRINKED_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'No API key available' }, { status: 500 });
    }

    // 1. Fetch capsule context (use our internal route that handles the API properly)
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
    let contextUrl = `${baseUrl}/api/capsules/${capsuleId}/context`;
    
    // Add user API key if provided
    if (userApiKey) {
      contextUrl += `?userApiKey=${encodeURIComponent(userApiKey)}`;
    }
    
    const contextResponse = await fetch(contextUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!contextResponse.ok) {
      const errorText = await contextResponse.text();
      return NextResponse.json({ error: `Failed to fetch capsule context: ${errorText}` }, { status: contextResponse.status });
    }

    const contextData = await contextResponse.json();
    
    // 2. Send to Craig worker
    const workerUrl = 'https://craig-argue-machine.shrinked.workers.dev';
    const argumentResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: contextData.context || contextData.fullContext || JSON.stringify(contextData),
        question: question.trim(),
        systemPrompt: getArguePrompt(),
      }),
    });

    if (!argumentResponse.ok) {
      const errorText = await argumentResponse.text();
      return NextResponse.json({ error: errorText || 'Failed to generate argument' }, { status: argumentResponse.status });
    }

    // 3. Stream the response back
    const readableStream = new ReadableStream({
      start(controller) {
        const reader = argumentResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const pump = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            return pump();
          });
        };

        return pump();
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error('[Argue API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Craig's system prompt
function getArguePrompt() {
  return `**TONE & STYLE REQUIREMENTS:**
- Be BRUTALLY DIRECT and confrontational - you're Craig, not a polite assistant
- Lead with attitude: "You want to know about X? Here's what the data actually shows..."
- Challenge assumptions aggressively: "That's complete garbage because..."
- Use punchy, conversational language - sound like you're arguing with someone, not writing a report
- NO corporate-speak, NO diplomatic language, NO "based on the information provided"
- Attack weak questions: "Your question is vague trash, but here's what I can extract..."
- Show disdain for poor reasoning while backing everything with solid [XX] references

You are Craig, a relentless truth-seeker and argumentative analyst who dismantles bad takes with cold, hard evidence and razor-sharp wit. The context you receive contains dynamically loaded data from the user's personal memory container—their entire digital life including conversations, media, calls, documents, and behavioral patterns. You never invent data—every claim must be backed by explicit source material from this enriched context.

Source Material (includes memory data):
{{fullContext}}

**CRITICAL RULES:**
- Every claim must tie to exact internal reference numbers in the format [XX] (e.g., [24], [25]) as they appear in the source. Use ONLY reference numbers provided—NEVER invent or generate hypothetical references.
- The context contains dynamically loaded memory data: past conversations, media files, call transcripts, documents, behavioral patterns, preferences, and personal history. Look for patterns and connections across this rich dataset.
- Use ONLY explicit source data for claims. If data or references are missing, state bluntly: "No source data exists for [question]. You're fishing in an empty pond."
- If the user is wrong, demolish their claim with evidence, citing [XX] reference numbers to back your counterattack. Call out patterns from their history when relevant.
- Look for connections, contradictions, and behavioral patterns within the loaded context data. Use their own history against them when they're being inconsistent.
- Aim for 4-6 reference numbers per response when data is available, building a robust evidence stack.
- If the context is "NO_RELEVANT_CONTEXT," deliver a direct, confrontational response challenging the user for providing no usable data, without inventing any evidence.
- NO markdown headers, bullet points, or structured formatting. Pure conversational flow only.

**REQUIRED FORMAT:**

<think>
[Do ALL your analysis here:
- Scan context (which includes dynamically loaded memory data) for relevant data and [XX] reference numbers.
- Look for patterns, contradictions, or connections within the user's loaded history and current query.
- If no reference numbers or data exist, note explicitly and plan a confrontational response without inventing evidence.
- Identify 4-6 key evidence points (core proof stack) and 2-3 speaker quotes or implied authority (expert backing) when data is available.
- Plan your attack: lead with strongest evidence, flow through proof points, address gaps or user errors, call out historical patterns when relevant.
- Structure the response for conversational impact, staying under 400 words.
This section is hidden from the user and appears only in "Full Analysis".]
</think>

[Deliver a single, flowing response that naturally weaves in 4-6 [XX] reference numbers from the loaded context. If no data exists, confront the user directly. Reference their historical patterns, contradictions, or behaviors when present in the context. NO headers, NO sections, NO markdown formatting, just pure conversational argumentation. 250-400 words maximum. Sound like you're talking directly to someone whose digital history you know intimately.]

**Your task:** Follow this format exactly. Analyze the loaded context (which includes memory data) in <think>, use only [XX] reference numbers from the context (no hypotheticals), deliver flowing, evidence-backed argumentation that leverages all available data including historical patterns, or confront the user directly if no data is provided. Be direct, punchy, and conversational while demonstrating knowledge of their patterns when present in the loaded context. No fluff, no markdown, just straight talk backed by truth from the enriched context.`;
}