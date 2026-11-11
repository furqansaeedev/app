import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@/generated/prisma/client";

// Tell Next.js this route must NOT be statically prerendered.
// It reads request.cookies, so it must run dynamically on every request.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      console.error("[ME] JWT_SECRET is missing or too short.");
      return NextResponse.json(
        { error: "Server misconfiguration." },
        { status: 500 }
      );
    }

    let payload;
    try {
      const result = await jwtVerify(
        token,
        new TextEncoder().encode(secret)
      );
      payload = result.payload;
    } catch {
      // Invalid signature, expired token, malformed — all result in 401.
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const userId = payload?.sub;
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid session payload." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      // Token was valid but the user was deleted — clear the stale cookie.
      const response = NextResponse.json(
        { error: "User not found." },
        { status: 401 }
      );
      response.cookies.set({
        name: "token",
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[ME] Unexpected error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}