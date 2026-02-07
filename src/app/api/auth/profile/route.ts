import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      department: user.department,
      group: user.group,
      groupChangeCount: user.groupChangeCount,
      bio: user.bio,
      privacyConsentAt: user.privacyConsentAt,
      termsConsentAt: user.termsConsentAt
    });
  } catch (error) {
    console.error("Profile error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const allowedUpdates = ['name', 'image', 'department', 'group', 'bio'];
    const updates: Record<string, unknown> = {};

    allowedUpdates.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    if (updates.group !== undefined) {
      const nextGroup = typeof updates.group === "string" ? updates.group.trim() : "";
      const normalizedGroup = nextGroup.length > 0 ? nextGroup : null;
      const isGroupChanging = normalizedGroup !== user.group;

      if (isGroupChanging && session.user.role === "STUDENT") {
        if (user.groupChangeCount >= 1) {
          return NextResponse.json(
            { error: "Группу можно изменить только один раз. Обратитесь к администрации." },
            { status: 403 }
          );
        }

        updates.group = normalizedGroup;
        updates.groupChangeCount = user.groupChangeCount + 1;
      } else {
        updates.group = normalizedGroup;
      }
    }

    const result = await prisma.user.update({
      where: { email: session.user.email },
      data: { ...updates, updatedAt: new Date() }
    });

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: result.id,
      action: "USER_PROFILE_UPDATE",
      entityType: "User",
      entityId: result.id,
      metadata: { updatedFields: Object.keys(updates) },
      ip,
      userAgent
    });

    return NextResponse.json({
      success: true,
      message: "Профиль обновлен",
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        image: result.image,
        department: result.department,
        group: result.group,
        groupChangeCount: result.groupChangeCount,
        bio: result.bio
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
