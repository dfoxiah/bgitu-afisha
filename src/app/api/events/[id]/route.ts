import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventCategory, ParticipantStatus } from "@prisma/client";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

const parseDateTime = (dateString: string, timeString?: string): Date | null => {
  try {
    if (!dateString) return null;

    if (dateString.includes('T')) {
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return null;
      if (timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (Number.isFinite(hours) && Number.isFinite(minutes)) {
          parsed.setHours(hours, minutes, 0, 0);
        }
      }
      return parsed;
    }

    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;

    let hours = 0;
    let minutes = 0;
    if (timeString) {
      const parts = timeString.split(':').map(Number);
      if (parts.length >= 2) {
        hours = parts[0];
        minutes = parts[1];
      }
    }

    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const isValidCategory = (category: string): boolean => {
  return Object.values(EventCategory).includes(category as EventCategory);
};

const splitParticipants = (eventParticipants: Array<{ status: ParticipantStatus; user: any }> = []) => {
  const confirmed = eventParticipants
    .filter(p => p.status === ParticipantStatus.CONFIRMED)
    .map(p => p.user);
  const pending = eventParticipants
    .filter(p => p.status === ParticipantStatus.PENDING)
    .map(p => p.user);

  return { confirmed, pending };
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
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

    if (!event) {
      return NextResponse.json(
        { error: "Мероприятие не найдено" },
        { status: 404 }
      );
    }

    const { confirmed, pending } = splitParticipants(event.eventParticipants);

    return NextResponse.json({
      ...event,
      currentParticipants: confirmed.length,
      participants: confirmed,
      pendingParticipants: pending,
      moderators: event.moderators?.map(m => m.user) || [],
      date: event.date.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      report: event.report
        ? {
            ...event.report,
            reportDate: event.report.reportDate.toISOString(),
            createdAt: event.report.createdAt.toISOString(),
            updatedAt: event.report.updatedAt.toISOString()
          }
        : null
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Недостаточно прав" },
        { status: 403 }
      );
    }

    const { id: eventId } = await params;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        creatorId: true,
        date: true,
        time: true,
        maxParticipants: true,
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
        { error: "Недостаточно прав для редактирования" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updateData: any = {};
    let confirmedParticipantIds: string[] | null = null;
    let moderatorIds: string[] | null = null;

    if (body.title) updateData.title = String(body.title).trim();
    if (body.description) updateData.description = String(body.description).trim();
    if (body.location) updateData.location = String(body.location).trim();
    if (body.duration) updateData.duration = String(body.duration).trim();
    if (body.responsible) updateData.responsible = String(body.responsible).trim();
    if (body.contact) updateData.contact = String(body.contact).trim();

    if (body.category) {
      if (!isValidCategory(body.category)) {
        return NextResponse.json(
          { error: `Недопустимая категория: ${body.category}` },
          { status: 400 }
        );
      }
      updateData.category = body.category as EventCategory;
    }

    if (body.maxParticipants !== undefined) {
      updateData.maxParticipants = parseInt(body.maxParticipants) || 0;
    }

    if (Array.isArray(body.images)) {
      updateData.images = body.images;
    }

    // Обновление даты/времени
    if (body.date || body.time) {
      const formatLocalDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const incomingDate = body.date ? String(body.date) : formatLocalDate(new Date(event.date));
      const incomingTime = body.time ? String(body.time).trim() : (event.time || "00:00");

      const parsedDate = parseDateTime(incomingDate, incomingTime);
      if (!parsedDate) {
        return NextResponse.json(
          { error: "Неверный формат даты" },
          { status: 400 }
        );
      }

      if (parsedDate < new Date()) {
        return NextResponse.json(
          { error: "Дата мероприятия не может быть в прошлом" },
          { status: 400 }
        );
      }

      updateData.date = parsedDate;
      if (body.time) {
        updateData.time = incomingTime;
      }
    }

    // Обновление участников по email
    if (Array.isArray(body.participants)) {
      const participantEmails = (body.participants as unknown[])
        .map(value => String(value).trim())
        .filter((email): email is string => Boolean(email));
      const uniqueEmails = Array.from(new Set<string>(participantEmails));

      let participantsToConnect: Array<{ id: string }> = [];
      if (uniqueEmails.length > 0) {
        const participantUsers = await prisma.user.findMany({
          where: { email: { in: uniqueEmails } },
          select: { id: true, email: true }
        });

        const foundEmails = new Set(participantUsers.map(u => u.email));
        const missingEmails = uniqueEmails.filter(email => !foundEmails.has(email));
        if (missingEmails.length > 0) {
          return NextResponse.json(
            { error: `Не найдены участники: ${missingEmails.join(', ')}` },
            { status: 400 }
          );
        }

        participantsToConnect = participantUsers.map(u => ({ id: u.id }));
      }

      const maxAllowed = updateData.maxParticipants !== undefined
        ? updateData.maxParticipants
        : event.maxParticipants;
      if (maxAllowed > 0 && participantsToConnect.length > maxAllowed) {
        return NextResponse.json(
          { error: 'Количество участников превышает лимит' },
          { status: 400 }
        );
      }

      confirmedParticipantIds = participantsToConnect.map(p => p.id);
    }

    if (Array.isArray(body.moderators)) {
      if (session.user.role !== "ADMIN" && !isOwner) {
        return NextResponse.json(
          { error: "Только создатель или администратор может изменять модераторов" },
          { status: 403 }
        );
      }

      const moderatorEmails = (body.moderators as unknown[])
        .map(value => String(value).trim())
        .filter((email): email is string => Boolean(email));
      const uniqueModeratorEmails = Array.from(new Set<string>(moderatorEmails));

      if (uniqueModeratorEmails.length === 0) {
        moderatorIds = [];
      } else {
        const moderatorUsers = await prisma.user.findMany({
          where: {
            email: { in: uniqueModeratorEmails },
            role: { in: ['TEACHER', 'ADMIN'] }
          },
          select: { id: true, email: true }
        });

        const foundEmails = new Set(moderatorUsers.map(u => u.email));
        const missingEmails = uniqueModeratorEmails.filter(email => !foundEmails.has(email));
        if (missingEmails.length > 0) {
          return NextResponse.json(
            { error: `Не найдены преподаватели: ${missingEmails.join(', ')}` },
            { status: 400 }
          );
        }

        moderatorIds = moderatorUsers
          .filter(u => u.id !== event.creatorId)
          .map(u => u.id);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.event.update({
          where: { id: eventId },
          data: updateData
        });
      }

      if (moderatorIds !== null) {
        await tx.eventModerator.deleteMany({
          where: {
            eventId,
            userId: { notIn: moderatorIds.length > 0 ? moderatorIds : ['__none__'] }
          }
        });

        if (moderatorIds.length > 0) {
          await tx.eventModerator.createMany({
            data: moderatorIds.map(userId => ({ eventId, userId })),
            skipDuplicates: true
          });
        }
      }

      if (confirmedParticipantIds !== null) {
        await tx.eventParticipant.deleteMany({
          where: {
            eventId,
            status: ParticipantStatus.CONFIRMED,
            userId: { notIn: confirmedParticipantIds.length > 0 ? confirmedParticipantIds : ['__none__'] }
          }
        });

        if (confirmedParticipantIds.length > 0) {
          await tx.eventParticipant.updateMany({
            where: { eventId, userId: { in: confirmedParticipantIds } },
            data: { status: ParticipantStatus.CONFIRMED }
          });

          await tx.eventParticipant.createMany({
            data: confirmedParticipantIds.map(userId => ({
              eventId,
              userId,
              status: ParticipantStatus.CONFIRMED
            })),
            skipDuplicates: true
          });
        }

        await tx.event.update({
          where: { id: eventId },
          data: { currentParticipants: confirmedParticipantIds.length }
        });
      }

      return tx.event.findUnique({
        where: { id: eventId },
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
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Мероприятие не найдено' },
        { status: 404 }
      );
    }

    const { confirmed, pending } = splitParticipants(updated.eventParticipants);

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_UPDATE",
      entityType: "Event",
      entityId: updated.id,
      metadata: {
        updatedFields: Object.keys(updateData),
        participantsUpdated: confirmedParticipantIds !== null,
        moderatorsUpdated: moderatorIds !== null
      },
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
    console.error("PUT /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

