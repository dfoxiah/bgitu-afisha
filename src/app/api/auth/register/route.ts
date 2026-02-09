// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { email, password, name, department, group, acceptPrivacy, acceptTerms } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f: email, \u043f\u0430\u0440\u043e\u043b\u044c, \u0438\u043c\u044f" },
        { status: 400 }
      );
    }

    if (!group || !String(group).trim()) {
      return NextResponse.json(
        { error: "\u0413\u0440\u0443\u043f\u043f\u0430 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u0430" },
        { status: 400 }
      );
    }
    if (!acceptPrivacy || !acceptTerms) {
      return NextResponse.json(
        { error: "Необходимо принять пользовательское соглашение и политику конфиденциальности" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const consentAt = new Date();
    const normalizedGroup = String(group).trim();

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "STUDENT",
        department: department || null,
        group: normalizedGroup,
        privacyConsentAt: consentAt,
        termsConsentAt: consentAt
      }
    });

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: user.id,
      action: "USER_REGISTER",
      entityType: "User",
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
      ip,
      userAgent
    });

    return NextResponse.json(
      {
        success: true,
        message: "Пользователь успешно создан",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          group: user.group
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
