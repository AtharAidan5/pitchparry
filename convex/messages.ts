import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add a message to the conversation
export const send = mutation({
  args: {
    sessionId: v.id("pitchSessions"),
    role: v.string(),
    content: v.string(),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      phase: args.phase,
      timestamp: Date.now(),
    });
  },
});

// Get all messages for a session (real-time)
export const list = query({
  args: { sessionId: v.id("pitchSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// Get recent messages (for context window)
export const getRecent = query({
  args: { 
    sessionId: v.id("pitchSessions"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit);
    return messages.reverse();
  },
});

// Clear messages (for restart)
export const clearSession = mutation({
  args: { sessionId: v.id("pitchSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});