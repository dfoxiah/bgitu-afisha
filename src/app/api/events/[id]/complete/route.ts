import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParticipantStatus } from "@prisma/client";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

const splitParticipants = (eventParticipants: Array<{ status: ParticipantStatus; user: any }> = []) => {
  const confirmed = eventParticipants
    .filter(p => p.status === ParticipantStatus.CONFIRMED)
    .map(p => p.user);
  const pending = eventParticipants
    .filter(p => p.status === ParticipantStatus.PENDING)
    .map(p => p.user);

  return { confirmed, pending };
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Недостаточно прав" },
        { status: 403 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        report: true,
        moderators: {
          select: { userId: true }
        }
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: "Мероприятие не найдено" },
        { status: 404 }
      );
    }

    const isOwner = event.creatorId === session.user.id;
    const isModerator = event.moderators.some(m => m.userId === session.user.id);
    const canModerate =
      session.user.role === "ADMIN" ||
      (session.user.role === "TEACHER" && (isOwner || isModerator));

    if (!canModerate) {
      return NextResponse.json(
        { error: "Недостаточно прав для завершения мероприятия" },
        { status: 403 }
      );
    }

    if (event.report) {
      return NextResponse.json(
        { error: "Мероприятие уже завершено" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    if (!summary) {
      return NextResponse.json(
        { error: "Заполните описание мероприятия" },
        { status: 400 }
      );
    }

    const tasks = Array.isArray(body.tasks)
      ? body.tasks.map((task: string) => task.trim()).filter(Boolean)
      : [];

    const activeParticipants = Array.isArray(body.activeParticipants)
      ? body.activeParticipants.map((p: string) => String(p)).filter(Boolean)
      : [];

    const images = Array.isArray(body.images)
      ? body.images.map((img: string) => String(img)).filter(Boolean)
      : [];

    const reportDate = body.reportDate ? new Date(body.reportDate) : new Date();

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        isPast: true,
        report: {
          create: {
            summary,
            tasks,
            activeParticipants,
            images,
            reportDate
          }
        }
      },
      include: {
        report: true,
        eventParticipants: {
          select: {
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                group: true,
                image: true,
                createdAt: true
              }
            }
          }
        },
        creator: true,
        moderators: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                group: true,
                image: true
              }
            }
          }
        }
      }
    });

    const { confirmed, pending } = splitParticipants(updated.eventParticipants);

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_COMPLETE",
      entityType: "Event",
      entityId: updated.id,
      metadata: { summaryLength: summary.length },
      ip,
      userAgent
    });

    return NextResponse.json({
      ...updated,
      currentParticipants: confirmed.length,
      participants: confirmed,
      pendingParticipants: pending,
      moderators: updated.moderators?.map(m => m.user) || [],
      date: updated.date.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      report: updated.report
        ? {
            ...updated.report,
            reportDate: updated.report.reportDate.toISOString(),
            createdAt: updated.report.createdAt.toISOString(),
            updatedAt: updated.report.updatedAt.toISOString()
          }
        : null
    });
  } catch (error) {
    console.error("Complete event error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
