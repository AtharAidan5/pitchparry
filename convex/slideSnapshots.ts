import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a slide snapshot
export const save = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    slideNumber: v.number(),
    analysis: v.string(),
    keyClaims: v.array(v.string()),
    weaknesses: v.array(v.string()),
    potentialQuestions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("slideSnapshots", {
      sessionId: args.sessionId,
      slideNumber: args.slideNumber,
      analysis: args.analysis,
      keyClaims: args.keyClaims,
      weaknesses: args.weaknesses,
      potentialQuestions: args.potentialQuestions,
      capturedAt: Date.now(),
    });
  },
});

// Get all snapshots for a session
export const list = query({
  args: { sessionId: v.id("pitchSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slideSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// Get latest snapshot
export const getLatest = query({
    args: { sessionId: v.id("pitchSessions") },
    handler: async (ctx, args) => {
      const snapshots = await ctx.db
        .query("slideSnapshots")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .take(1);
      return snapshots[0] || null;
    },
  });