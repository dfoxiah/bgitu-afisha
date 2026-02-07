// src/app/api/events/[id]/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParticipantStatus } from "@prisma/client";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        isPast: true,
        date: true,
        maxParticipants: true,
        currentParticipants: true
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: "Мероприятие не найдено" },
        { status: 404 }
      );
    }

    if (event.isPast || new Date(event.date) < new Date()) {
      return NextResponse.json(
        { error: "Мероприятие уже завершено" },
        { status: 400 }
      );
    }

    if (event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants) {
      return NextResponse.json(
        { error: "Достигнуто максимальное количество участников" },
        { status: 400 }
      );
    }

    const existing = await prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: "Вы уже зарегистрированы на это мероприятие" },
        { status: 400 }
      );
    }

    const isPrivileged = session.user.role === "TEACHER" || session.user.role === "ADMIN";
    const status = isPrivileged ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING;

    await prisma.$transaction(async (tx) => {
      await tx.eventParticipant.create({
        data: {
          eventId,
          userId: session.user.id,
          status
        }
      });

      if (status === ParticipantStatus.CONFIRMED) {
        await tx.event.update({
          where: { id: eventId },
          data: { currentParticipants: { increment: 1 } }
        });
      }
    });

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_REGISTER",
      entityType: "Event",
      entityId: eventId,
      metadata: { status },
      ip,
      userAgent
    });

    return NextResponse.json({
      success: true,
      status,
      message: status === ParticipantStatus.CONFIRMED
        ? "Вы успешно зарегистрированы на мероприятие"
        : "Заявка отправлена, ожидайте подтверждения"
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
