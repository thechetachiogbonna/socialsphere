import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest, NextResponse } from 'next/server'
import { api } from '../../../../../convex/_generated/api';
import { convex } from '@/config/convex';

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === "user.created") {
      await convex.mutation(api.user.createUser, {
        clerk_userId: evt.data.id!,
        first_name: evt.data.first_name ?? "",
        last_name: evt.data.last_name ?? "",
        username: evt.data.username ?? "",
        email: evt.data.email_addresses[0]?.email_address ?? "",
        profile_pic: evt.data.image_url ?? "",
      });

      return NextResponse.json({ status: "success" }, { status: 200 });
    }

    if (evt.type === "user.deleted") {
      await convex.mutation(api.user.deleteUser, {
        clerk_userId: evt.data.id!
      });

      return NextResponse.json({ status: "success" }, { status: 200 });
    }

    if (evt.type === "user.updated") {
      const existingUser = await convex.query(api.user.getUserByClerkId, {
        clerk_userId: evt.data.id!,
      });

      await convex.mutation(api.user.updateUser, {
        clerk_userId: evt.data.id!,
        first_name: evt.data.first_name ?? existingUser?.first_name ?? "",
        last_name: evt.data.last_name ?? existingUser?.last_name ?? "",
        username: evt.data.username ?? existingUser?.username ?? "",
        email: evt.data.email_addresses[0]?.email_address ?? existingUser?.email ?? "",
        profile_pic: evt.data.image_url ?? existingUser?.profile_pic ?? "",
      });
      return NextResponse.json({ status: "success" }, { status: 200 });
    }

    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}