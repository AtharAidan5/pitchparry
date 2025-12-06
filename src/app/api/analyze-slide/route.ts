import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { base64Image } = await req.json();

    // Remove data URL prefix if present
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageData,
              },
            },
            {
              type: "text",
              text: `You are analyzing a startup pitch deck slide. Describe what you see and identify:

1. Key claims or statements being made
2. Potential weaknesses or gaps in the argument
3. Questions an investor might ask

Respond in JSON format:
{
  "slideAnalysis": "Brief description of the slide content",
  "keyClaims": ["claim1", "claim2"],
  "weaknesses": ["weakness1", "weakness2"],
  "potentialQuestions": ["question1", "question2"]
}

Only respond with valid JSON, no other text.`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const parsed = JSON.parse(content.text);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({
          slideAnalysis: content.text,
          keyClaims: [],
          weaknesses: [],
          potentialQuestions: [],
        });
      }
    }

    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  } catch (error) {
    console.error("Slide analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}