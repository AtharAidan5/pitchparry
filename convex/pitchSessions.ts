import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new pitch session
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const sessionId = await ctx.db.insert("pitchSessions", {
      phase: "preparing",
      createdAt: Date.now(),
    });
    return sessionId;
  },
});

// Get a session by ID
export const get = query({
  args: { sessionId: v.id("pitchSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Update session phase
export const updatePhase = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { phase: args.phase });
  },
});

// Save current slide analysis
export const saveSlideAnalysis = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    currentSlideAnalysis: v.string(),
    weaknesses: v.array(v.string()),
    keyClaims: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      currentSlideAnalysis: args.currentSlideAnalysis,
      weaknesses: args.weaknesses,
      keyClaims: args.keyClaims,
    });
  },
});

// Save final feedback and score
export const saveFeedback = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    overallScore: v.number(),
    topImprovements: v.array(v.string()),
    deliveryFeedback: v.object({
      voiceTone: v.string(),
      pacing: v.string(),
      confidence: v.number(),
      fillerWords: v.array(v.string()),
    }),
    contentFeedback: v.object({
      clarity: v.number(),
      marketSizing: v.string(),
      competitiveAnalysis: v.string(),
      suggestions: v.array(v.string()),
    }),
    presentationFeedback: v.object({
      structure: v.string(),
      storytelling: v.number(),
      slideUsage: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      overallScore: args.overallScore,
      topImprovements: args.topImprovements,
      deliveryFeedback: args.deliveryFeedback,
      contentFeedback: args.contentFeedback,
      presentationFeedback: args.presentationFeedback,
      phase: "debrief",
      endedAt: Date.now(),
    });
  },
});

// End session
export const endSession = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    pitchDurationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      phase: "wrapup",
      pitchDurationSeconds: args.pitchDurationSeconds,
      endedAt: Date.now(),
    });
  },
});