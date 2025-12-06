import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are an expert pitch coach analyzing a startup pitch session. Provide detailed, constructive feedback.`,
      messages: [
        {
          role: "user",
          content: `Analyze this pitch session transcript and provide feedback:

${transcript}

Respond in this exact JSON format:
{
  "overallScore": 72,
  "topImprovements": [
    "First most important improvement",
    "Second improvement",
    "Third improvement"
  ],
  "deliveryFeedback": {
    "voiceTone": "Assessment of voice confidence and energy",
    "pacing": "Assessment of speaking pace",
    "confidence": 7,
    "fillerWords": ["um", "like"]
  },
  "contentFeedback": {
    "clarity": 8,
    "marketSizing": "Assessment of market size claims",
    "competitiveAnalysis": "Assessment of competitive positioning",
    "suggestions": ["Suggestion 1", "Suggestion 2"]
  },
  "presentationFeedback": {
    "structure": "Assessment of pitch structure and flow",
    "storytelling": 6,
    "slideUsage": "Assessment of how well they referenced visuals"
  }
}

Only respond with valid JSON, no other text.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const parsed = JSON.parse(content.text);
        return NextResponse.json(parsed);
      } catch {
        // If JSON parsing fails, return default structure
        return NextResponse.json({
          overallScore: 65,
          topImprovements: [
            "Structure your pitch with a clearer narrative arc",
            "Provide more specific metrics and data points",
            "Address competitive threats more directly",
          ],
          deliveryFeedback: {
            voiceTone: "Could not fully analyze",
            pacing: "Could not fully analyze",
            confidence: 6,
            fillerWords: [],
          },
          contentFeedback: {
            clarity: 6,
            marketSizing: "Needs more specific data",
            competitiveAnalysis: "Could be stronger",
            suggestions: ["Add more specifics"],
          },
          presentationFeedback: {
            structure: "Room for improvement",
            storytelling: 6,
            slideUsage: "Could not fully analyze",
          },
        });
      }
    }

    return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 });
  } catch (error) {
    console.error("Feedback generation error:", error);
    return NextResponse.json({ error: "Feedback failed" }, { status: 500 });
  }
}