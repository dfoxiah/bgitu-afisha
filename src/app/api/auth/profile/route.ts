import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventCategory } from "@prisma/client";
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
      notifyNewEvents: user.notifyNewEvents,
      notifyChanges: user.notifyChanges,
      notifyNews: user.notifyNews,
      notificationCategories: user.notificationCategories,
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

    const allowedUpdates = [
      'name',
      'image',
      'department',
      'group',
      'bio',
      'notifyNewEvents',
      'notifyChanges',
      'notifyNews',
      'notificationCategories'
    ];
    const updates: Record<string, unknown> = {};

    allowedUpdates.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    if (body.notifications && typeof body.notifications === "object") {
      const notifications = body.notifications as Record<string, unknown>;
      if (typeof notifications.newEvents === "boolean") {
        updates.notifyNewEvents = notifications.newEvents;
      }
      if (typeof notifications.changes === "boolean") {
        updates.notifyChanges = notifications.changes;
      }
      if (typeof notifications.news === "boolean") {
        updates.notifyNews = notifications.news;
      }
      if (Array.isArray(notifications.categories)) {
        const categories = notifications.categories
          .map((value) => String(value).trim())
          .filter((value) => Object.values(EventCategory).includes(value as EventCategory));
        updates.notificationCategories = Array.from(new Set(categories));
      }
    }

    if (updates.notificationCategories !== undefined) {
      if (Array.isArray(updates.notificationCategories)) {
        const categories = (updates.notificationCategories as unknown[])
          .map((value) => String(value).trim())
          .filter((value) => Object.values(EventCategory).includes(value as EventCategory));
        updates.notificationCategories = Array.from(new Set(categories));
      } else {
        delete updates.notificationCategories;
      }
    }

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
        bio: result.bio,
        notifyNewEvents: result.notifyNewEvents,
        notifyChanges: result.notifyChanges,
        notifyNews: result.notifyNews,
        notificationCategories: result.notificationCategories
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
