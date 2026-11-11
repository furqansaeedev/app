import { NextResponse } from "next/server";
import { z } from "zod";
import { jwtVerify } from "jose";
import nodemailer from "nodemailer";
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

const applicationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name must be at most 100 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is too short.")
    .max(20, "Phone number is too long.")
    .regex(
      /^[+\d][\d\s\-()]{6,19}$/,
      "Please enter a valid phone number (digits, spaces, +, -, parentheses)."
    ),
  message: z
    .string()
    .trim()
    .max(2000, "Message must be at most 2000 characters.")
    .optional()
    .or(z.literal("")),
});

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function POST(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to submit an application." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Invalid input.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { fullName, email, phone, message } = parsed.data;

    // Friendly pre-check — better UX than waiting for the DB constraint error
    const existing = await prisma.application.findUnique({
      where: { userId },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "You have already submitted an application. Only one application per user is allowed.",
        },
        { status: 409 }
      );
    }

    // Verify the user still exists (defensive — JWT could outlive a deleted user)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Your account no longer exists. Please log in again." },
        { status: 401 }
      );
    }

    // ---- 1. Save the application FIRST ----
    const application = await prisma.application.create({
      data: {
        fullName,
        email,
        phone,
        message: message ? message : null,
        userId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        message: true,
        userId: true,
        createdAt: true,
      },
    });

    // ---- 2. THEN send emails (failures do NOT roll back the save) ----
    // Per requirement: save-then-email. If email fails, the user still sees
    // success because the application is persisted. Errors are logged only.
    const transporter = buildTransporter();
    if (!transporter) {
      console.error(
        "[APPLICATIONS POST] GMAIL_USER or GMAIL_APP_PASSWORD is missing. Skipping email notifications."
      );
    } else {
      const fromAddress = process.env.GMAIL_USER;
      const adminAddress = process.env.ADMIN_EMAIL;

      // --- 2a. Admin notification ---
      if (!adminAddress) {
        console.error(
          "[APPLICATIONS POST] ADMIN_EMAIL is missing. Skipping admin notification."
        );
      } else {
        try {
          const adminSubject = `New Application: ${fullName}`;
          const adminText = [
            "A new application has been submitted.",
            "",
            `Name:    ${fullName}`,
            `Email:   ${email}`,
            `Phone:   ${phone}`,
            `Message: ${message ? message : "(no message)"}`,
            "",
            `Application ID: ${application.id}`,
            `Submitted at:   ${application.createdAt.toISOString()}`,
            `User ID:        ${application.userId}`,
          ].join("\n");

          const adminHtml = `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.6;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#4f46e5;">New Application Received</h2>
              <p style="margin:0 0 16px;">A new application has been submitted via ApplyHub.</p>
              <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <tr><td style="background:#f8fafc;font-weight:600;">Name</td><td>${escapeHtml(fullName)}</td></tr>
                <tr><td style="background:#f8fafc;font-weight:600;">Email</td><td>${escapeHtml(email)}</td></tr>
                <tr><td style="background:#f8fafc;font-weight:600;">Phone</td><td>${escapeHtml(phone)}</td></tr>
                <tr><td style="background:#f8fafc;font-weight:600;vertical-align:top;">Message</td><td>${message ? escapeHtml(message) : "(no message)"}</td></tr>
                <tr><td style="background:#f8fafc;font-weight:600;">Application ID</td><td>${escapeHtml(application.id)}</td></tr>
                <tr><td style="background:#f8fafc;font-weight:600;">Submitted at</td><td>${escapeHtml(application.createdAt.toISOString())}</td></tr>
              </table>
            </div>
          `;

          await transporter.sendMail({
            from: `"ApplyHub" <${fromAddress}>`,
            to: adminAddress,
            replyTo: email,
            subject: adminSubject,
            text: adminText,
            html: adminHtml,
          });

          console.log(
            `[APPLICATIONS POST] Admin notification sent to ${adminAddress} for application ${application.id}.`
          );
        } catch (emailError) {
          console.error(
            "[APPLICATIONS POST] Failed to send admin notification:",
            emailError
          );
        }
      }

      // --- 2b. Applicant confirmation ---
      if (email) {
        try {
          const applicantSubject = "We received your application";
          const applicantText = [
            `Hi ${fullName},`,
            "",
            "Thanks for applying. We've received your application and will be in touch shortly.",
            "",
            "Summary of what you submitted:",
            `  Phone:   ${phone}`,
            `  Message: ${message ? message : "(no message)"}`,
            "",
            "— The ApplyHub Team",
          ].join("\n");

          const applicantHtml = `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.6;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#4f46e5;">We received your application</h2>
              <p style="margin:0 0 12px;">Hi ${escapeHtml(fullName)},</p>
              <p style="margin:0 0 16px;">Thanks for applying. We&rsquo;ve received your application and will be in touch shortly.</p>
              <p style="margin:0 0 8px;font-weight:600;">Summary of what you submitted:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li><strong>Phone:</strong> ${escapeHtml(phone)}</li>
                <li><strong>Message:</strong> ${message ? escapeHtml(message) : "(no message)"}</li>
              </ul>
              <p style="margin:16px 0 0;color:#475569;">&mdash; The ApplyHub Team</p>
            </div>
          `;

          await transporter.sendMail({
            from: `"ApplyHub" <${fromAddress}>`,
            to: email,
            subject: applicantSubject,
            text: applicantText,
            html: applicantHtml,
          });

          console.log(
            `[APPLICATIONS POST] Applicant confirmation sent to ${email} for application ${application.id}.`
          );
        } catch (emailError) {
          console.error(
            "[APPLICATIONS POST] Failed to send applicant confirmation:",
            emailError
          );
        }
      }
    }

    // ---- 3. Response is ALWAYS 201 after a successful save ----
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "You have already submitted an application. Only one application per user is allowed.",
        },
        { status: 409 }
      );
    }
    if (error?.code === "P2003") {
      return NextResponse.json(
        { error: "Your account could not be found. Please log in again." },
        { status: 401 }
      );
    }
    console.error("[APPLICATIONS POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}