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
        { error: "Заполните обязательные поля: email, пароль, имя" },
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

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "STUDENT",
        department: department || null,
        group: group || null,
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
