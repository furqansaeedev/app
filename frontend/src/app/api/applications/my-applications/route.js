import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@/generated/prisma/client";

// Tell Next.js this route must NOT be statically prerendered.
// It reads request.cookies, so it must run dynamically on every request.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const prisma = new PrismaClient();

async function getAuthenticatedUserId(request) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return payload?.sub || null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view your applications." },
        { status: 401 }
      );
    }

    const applications = await prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        message: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("[MY-APPLICATIONS GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}