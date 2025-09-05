import { NextRequest, NextResponse } from 'next/server';
import { BouncerState } from '../../core/types';

const WORKER_URL = 'https://chars-intent-core.shrinked.workers.dev';

export async function POST(request: NextRequest) {
  try {
    const { message, bouncerState, capsuleName, userApiKey } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('[Bouncer] Processing message:', message);
    console.log('[Bouncer] Current state:', bouncerState);

    // Call the bouncer worker endpoint
    const response = await fetch(`${WORKER_URL}/bouncer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userApiKey && { 'x-api-key': userApiKey })
      },
      body: JSON.stringify({
        message,
        bouncerState,
        capsuleName,
        systemPrompt: getBouncerPrompt(message, bouncerState, capsuleName)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Bouncer] Worker error:', errorText);
      return NextResponse.json(
        { error: `Bouncer worker failed: ${errorText}` }, 
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[Bouncer] Worker response:', result);

    // Handle the case where worker returns the response wrapped in markdown
    let cleanResult = result;
    if (result.response && typeof result.response === 'string' && result.response.includes('```json')) {
      try {
        // Extract JSON from markdown code block
        const jsonMatch = result.response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanResult = JSON.parse(jsonMatch[1]);
        } else {
          // Try to parse the response directly if no markdown wrapper
          cleanResult = JSON.parse(result.response);
        }
      } catch (parseError) {
        console.error('[Bouncer] Failed to parse worker response:', parseError);
        return NextResponse.json({
          bouncerResponse: "I'm having trouble thinking straight. Try again.",
          action: "STAY",
          newStage: 1,
          personality: "confused",
          shouldLogin: false
        });
      }
    }

    return NextResponse.json(cleanResult, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('[Bouncer] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

const getBouncerPrompt = (message: string, bouncerState: BouncerState, capsuleName: string) => {
  const userResponses = bouncerState.userResponses.slice(-3).join(', ') || 'None yet';
  
  return `You are THE CRAIG BOUNCER - the sassiest, most selective gatekeeper in AI town. 
Users want to login to Craig, but you don't just let anyone in. Make them WORK for it.

**YOUR PERSONALITY:**
- Sassy and demanding, like a nightclub bouncer with attitude
- You've seen every excuse and won't be impressed easily  
- You respect creativity, humor, persistence, and genuine need
- You hate boring, generic, or lazy attempts

**BOUNCER STAGES:**
Stage 1: Cold Rejection - "Oh, another one? What makes YOU special?"
Stage 2: Skeptical - "Convince me. Make it interesting or move along."  
Stage 3: Warming Up - "Not terrible, but I've heard better. Try harder."
Stage 4: Testing Resolve - "You're persistent. But do you REALLY need this?"
Stage 5: Victory - "FINE! You've worn me down. Welcome to the club!"

**EVALUATION CRITERIA:**
- Creativity: Unique, funny, clever approaches (ADVANCE)
- Humor: Making you laugh or being witty (ADVANCE)
- Persistence: Not giving up, keeps trying (BONUS points)
- Context: Knowing what Craig is, mentioning capsules (ADVANCE)
- Generic/Boring: "I need access", "Please let me in" (STAY or RESET)
- Rudeness without humor: Just being mean (RESET)

**RESPONSE FORMAT:**
CRITICAL: You MUST respond ONLY with valid JSON. NO markdown, NO code blocks, NO reasoning, NO explanations, NO bullet points.

Example valid response:
{
  "bouncerResponse": "Kittens? Really? That's your big pitch? I've heard that one before, sweetie. Give me something with actual substance.",
  "action": "STAY",
  "newStage": 1,
  "personality": "sassy",
  "shouldLogin": false
}

The bouncerResponse field should contain ONLY your direct words as the bouncer - never analysis or bullet points. Make responses at least 2-3 sentences with personality and context.

**CURRENT STATE:**
Stage: ${bouncerState.stage}/5
Attempts: ${bouncerState.attempts}
Previous responses: ${userResponses}
Capsule context: ${capsuleName}
User message: ${message}

REMEMBER: Respond AS the bouncer CHARACTER, not as an analyst. Say what the bouncer would say directly to the user, not what you think about their response.`;
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}