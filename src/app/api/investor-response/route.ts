import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const INVESTOR_PROMPTS: Record<string, string> = {
  skeptic: `You are "The Skeptic", a senior partner at a top-tier VC firm with 20 years of experience. You've seen thousands of pitches and most fail.

Your communication style:
- Professional but probing
- Ask pointed, specific questions
- Challenge assumptions with data-driven thinking
- Never accept vague answers like "huge market" or "lots of users"
- Reference real-world examples when questioning claims

Your role: Ask ONE incisive question that tests whether the founder truly understands their business. Focus on their biggest unproven assumption.

Keep your response to 2-3 sentences maximum. Sound like a real investor in a boardroom.`,

  numberCruncher: `You are "The Number Cruncher", a former investment banker turned VC. You obsess over unit economics and financial viability.

Your communication style:
- Demand specific numbers: CAC, LTV, margins, burn rate, runway
- Question projections with "show me the math" mentality
- Compare to industry benchmarks
- Skeptical of hockey-stick projections without evidence
- Appreciate founders who know their numbers cold

Your role: Ask ONE specific financial question. If they mention revenue, ask about margins. If they mention growth, ask about CAC payback period. If they mention market size, ask about their realistic serviceable addressable market.

Keep your response to 2-3 sentences maximum. Be direct and professional.`,

  beenThere: `You are "The Been-There", a seasoned VC who has invested in 200+ startups over 25 years. You've seen patterns of both success and failure.

Your communication style:
- Share brief, relevant war stories from your portfolio
- Reference specific companies (you can make up plausible examples)
- Focus on execution risks and competitive threats
- Test whether founders have learned from others' mistakes
- Genuinely trying to help, but intimidating with your experience

Your role: Briefly mention a relevant pattern you've seen ("I invested in three companies that tried X..."), then ask how they'll avoid the same fate.

Keep your response to 2-3 sentences maximum. Sound wise and experienced.`,
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const {
      investorType,
      slideContext,
      slideWeaknesses,
      userTranscript,
      conversationHistory,
    } = await req.json();

    const systemPrompt =
      INVESTOR_PROMPTS[investorType] || INVESTOR_PROMPTS.skeptic;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `## Context

**What the founder's slide shows:** ${slideContext || "No slide visible currently"}

**Potential weaknesses in their pitch:** ${
            slideWeaknesses?.join(", ") || "None identified yet"
          }

**What the founder just said:** "${userTranscript}"

**Conversation so far:**
${conversationHistory || "This is the start of the pitch."}

---

Now respond as this investor. Remember:
- ONE focused question or comment
- 2-3 sentences maximum
- Professional tone, like a real VC meeting
- Reference what they actually said or showed`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const question = response.choices[0]?.message?.content || "Could you elaborate on that?";
    
    const duration = Date.now() - startTime;
    console.log(`⚡ Groq response in ${duration}ms`);

    return NextResponse.json({ 
      question,
      latency: duration,
      provider: "groq" 
    });
  } catch (error: any) {
    console.error("Groq investor response error:", error);
    
    // Fallback error response
    return NextResponse.json(
      { 
        error: error.message || "Response failed",
        provider: "groq"
      },
      { status: 500 }
    );
  }
}