import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Invalid input.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Same error for "no such user" and "wrong password" — never leak which.
    const genericError = NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );

    if (!user) return genericError;

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) return genericError;

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      console.error(
        "[LOGIN] JWT_SECRET is missing or too short. Set it to 64+ random characters in .env"
      );
      return NextResponse.json(
        { error: "Server misconfiguration. Please contact the administrator." },
        { status: 500 }
      );
    }

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(secret));

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SEVEN_DAYS_IN_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("[LOGIN] Unexpected error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}