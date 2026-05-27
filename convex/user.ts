import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return;
    }

    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();
  },
})

export const getUserByClerkId = query({
  args: {
    clerk_userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("byClerkId", (q) => q.eq("clerk_userId", args.clerk_userId))
      .first();
  },
});

export const createUser = mutation({
  args: {
    clerk_userId: v.string(),
    first_name: v.string(),
    last_name: v.string(),
    username: v.string(),
    email: v.string(),
    profile_pic: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("users", {
      clerk_userId: args.clerk_userId,
      first_name: args.first_name,
      last_name: args.last_name,
      username: args.username,
      email: args.email,
      profile_pic: args.profile_pic,
      profile_pic_id: undefined,
      cover_photo: undefined,
      cover_photo_id: undefined,
      bio: undefined,
      followers: [],
      following: []
    });
  },
});

export const updateUser = mutation({
  args: {
    clerk_userId: v.string(),
    first_name: v.string(),
    last_name: v.string(),
    username: v.string(),
    email: v.string(),
    profile_pic: v.string(),
    profile_pic_id: v.optional(v.string()),
    cover_photo: v.optional(v.string()),
    cover_photo_id: v.optional(v.string()),
    bio: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("byClerkId", q => q.eq("clerk_userId", args.clerk_userId)).first()

    if (!user) {
      throw new Error("User not found");
    }

    return ctx.db.patch(user._id, {
      first_name: args.first_name,
      last_name: args.last_name,
      username: args.username,
      email: args.email,
      profile_pic: args.profile_pic,
      profile_pic_id: args.profile_pic_id || undefined,
      cover_photo: args.cover_photo || undefined,
      cover_photo_id: args.cover_photo_id || undefined,
      bio: args.bio || undefined,
    });
  }
});

export const deleteUser = mutation({
  args: {
    clerk_userId: v.string()
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("byClerkId", q => q.eq("clerk_userId", args.clerk_userId)).first();

    if (!user) {
      throw new Error("User not found");
    }

    return ctx.db.delete(user._id);
  }
});

export const getOtherUsers = query({
  args: {
    userId: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    const { userId } = args
    if (!userId) return;

    const allUsers = await ctx.db.query("users").collect()
    return allUsers
      .filter((user => user._id !== userId))
      .map(user => ({ ...user, isFollowing: (user.followers || []).includes(userId) }));
  }
})

export const getUserById = query({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    return user;
  }
})

export const toggleFollow = mutation({
  args: {
    targetUserId: v.id("users"),
    currentUserId: v.id("users")
  },
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.currentUserId);
    if (!viewer) throw new Error("Viewer not found");

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("Target user not found");

    const isFollowing = (viewer.following || []).includes(args.targetUserId);
    const nextFollowing = isFollowing
      ? (viewer.following || []).filter((id) => id !== args.targetUserId)
      : [...(viewer.following || []), args.targetUserId];

    const nextFollowers = isFollowing
      ? (target.followers || []).filter((id) => id !== viewer._id)
      : [...(target.followers || []), viewer._id];

    await Promise.all([
      ctx.db.patch(viewer._id, { following: nextFollowing }),
      ctx.db.patch(args.targetUserId, { followers: nextFollowers }),
    ]);
  },
})