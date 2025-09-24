import { NextRequest, NextResponse } from 'next/server';
import { getArguePrompt } from '../../components/ArguePrompt';

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

    // 3. Collect the full streaming response
    if (!argumentResponse.body) {
      return NextResponse.json({ error: 'Response body is empty' }, { status: 500 });
    }

    const reader = argumentResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chatResponse = '';
    let reasoningResponse = '';

    // Collect all chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.type === 'filtered') {
            if (parsed.content && !parsed.content.includes('NO_RELEVANT_CONTEXT')) {
              // Try to extract reasoning from the filtered content if it's JSON
              try {
                const filteredData = JSON.parse(parsed.content);
                if (filteredData.output && filteredData.output[0] && filteredData.output[0].content) {
                  const reasoningContent = filteredData.output[0].content[0];
                  if (reasoningContent.type === 'reasoning_text') {
                    reasoningResponse = reasoningContent.text || '';
                  }
                }
              } catch (e) {
                // If not JSON, use the content as is
                reasoningResponse = parsed.content;
              }
            }
          } else if (parsed.type === 'response' && parsed.content) {
            if (parsed.content.chat) {
              chatResponse += parsed.content.chat;
            }
            if (parsed.content.reasoning && !reasoningResponse) {
              reasoningResponse = parsed.content.reasoning;
            }
          }
        } catch (e) {
          console.warn('Failed to parse line:', line);
        }
      }
    }

    // Return structured response
    return NextResponse.json({
      success: true,
      response: chatResponse.trim(),
      reasoning: reasoningResponse.trim(),
      capsuleId: capsuleId,
      question: question.trim()
    });

  } catch (error: any) {
    console.error('[Argue API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

