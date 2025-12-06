import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pitchSessions: defineTable({
    // Session state
    phase: v.string(),
    pitchDurationSeconds: v.optional(v.number()),

    // Slide analysis
    currentSlideAnalysis: v.optional(v.string()),
    weaknesses: v.optional(v.array(v.string())),
    keyClaims: v.optional(v.array(v.string())),

    // Delivery feedback
    deliveryFeedback: v.optional(
      v.object({
        voiceTone: v.string(),
        pacing: v.string(),
        confidence: v.number(),
        fillerWords: v.array(v.string()),
      })
    ),

    // Content feedback
    contentFeedback: v.optional(
      v.object({
        clarity: v.number(),
        marketSizing: v.string(),
        competitiveAnalysis: v.string(),
        suggestions: v.array(v.string()),
      })
    ),

    // Presentation feedback
    presentationFeedback: v.optional(
      v.object({
        structure: v.string(),
        storytelling: v.number(),
        slideUsage: v.string(),
      })
    ),

    // Final results
    overallScore: v.optional(v.number()),
    topImprovements: v.optional(v.array(v.string())),

    createdAt: v.number(),
    endedAt: v.optional(v.number()),
  }),

  messages: defineTable({
    sessionId: v.id("pitchSessions"),
    role: v.string(),
    content: v.string(),
    phase: v.string(),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  slideSnapshots: defineTable({
    sessionId: v.id("pitchSessions"),
    slideNumber: v.number(),
    analysis: v.string(),
    keyClaims: v.array(v.string()),
    weaknesses: v.array(v.string()),
    potentialQuestions: v.array(v.string()),
    capturedAt: v.number(),
  }).index("by_session", ["sessionId"]),
});