import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventCategory, NotificationType, ParticipantStatus, Prisma } from "@prisma/client";
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

const toAuditValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item instanceof Date) return item.toISOString();
      if (item === null || item === undefined) return null;
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
      return String(item);
    });
  }
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
};

const buildFieldChanges = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
) => {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  fields.forEach((field) => {
    const beforeValue = toAuditValue(before[field]);
    const afterValue = toAuditValue(after[field]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = { before: beforeValue, after: afterValue };
    }
  });
  return changes;
};

const buildEventAuditInfo = (
  event: {
    title: string;
    category: EventCategory | string;
    date: Date;
    time: string | null;
    location: string;
    description?: string | null;
    duration?: string | null;
    maxParticipants: number;
    currentParticipants?: number;
    isNews?: boolean;
    removedFromCalendar?: boolean;
    images?: string[];
    responsible?: string | null;
    contact?: string | null;
  },
  participantsCount: number,
  moderatorsCount: number
) => ({
  title: event.title,
  category: String(event.category),
  date: event.date.toISOString(),
  time: event.time || "",
  location: event.location,
  description: event.description || "",
  duration: event.duration || "",
  maxParticipants: event.maxParticipants,
  currentParticipants: participantsCount,
  moderatorsCount,
  imagesCount: Array.isArray(event.images) ? event.images.length : 0,
  isNews: Boolean(event.isNews),
  removedFromCalendar: Boolean(event.removedFromCalendar),
  responsible: event.responsible || "",
  contact: event.contact || ""
});

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
        title: true,
        description: true,
        location: true,
        duration: true,
        responsible: true,
        contact: true,
        category: true,
        creatorId: true,
        date: true,
        time: true,
        maxParticipants: true,
        currentParticipants: true,
        isNews: true,
        removedFromCalendar: true,
        images: true,
        eventParticipants: {
          select: {
            userId: true,
            status: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        moderators: {
          select: {
            userId: true,
            user: {
              select: {
                email: true
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

    try {
      const existingParticipantIds = event.eventParticipants.map(p => p.userId);
      const existingPendingIds = event.eventParticipants
        .filter(p => p.status === ParticipantStatus.PENDING)
        .map(p => p.userId);
      const existingModeratorIds = event.moderators.map(m => m.userId);

      const newlyAddedParticipantIds = confirmedParticipantIds
        ? confirmedParticipantIds.filter(id => !existingParticipantIds.includes(id))
        : [];
      const newlyConfirmedIds = confirmedParticipantIds
        ? confirmedParticipantIds.filter(id => existingPendingIds.includes(id))
        : [];
      const newlyAddedModeratorIds = moderatorIds
        ? moderatorIds.filter(id => !existingModeratorIds.includes(id))
        : [];

      const eventDateText = new Date(updated.date).toLocaleDateString('ru-RU');
      const timeText = updated.time ? ` ${updated.time}` : '';
      const locationText = updated.location ? `, место: ${updated.location}` : '';

      const notifications: Prisma.NotificationCreateManyInput[] = [];

      const loadChangeRecipients = async (ids: string[]) => {
        if (ids.length === 0) return new Set<string>();
        const users = await prisma.user.findMany({
          where: {
            id: { in: ids },
            notifyChanges: true
          },
          select: { id: true }
        });
        return new Set(users.map(user => user.id));
      };

      const addedRecipients = await loadChangeRecipients([
        ...newlyAddedParticipantIds,
        ...newlyConfirmedIds,
        ...newlyAddedModeratorIds
      ]);

      for (const userId of newlyAddedParticipantIds) {
        if (!addedRecipients.has(userId) || userId === session.user.id) continue;
        notifications.push({
          userId,
          title: 'Добавление в мероприятие',
          content: `Вас добавили в мероприятие «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.EVENT,
          read: false,
          metadata: { eventId: updated.id, action: 'participant_added' }
        });
      }

      for (const userId of newlyConfirmedIds) {
        if (!addedRecipients.has(userId) || userId === session.user.id) continue;
        notifications.push({
          userId,
          title: 'Участие подтверждено',
          content: `Ваше участие в мероприятии «${updated.title}» подтверждено. Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.CHANGE,
          read: false,
          metadata: { eventId: updated.id, action: 'participant_confirmed' }
        });
      }

      for (const userId of newlyAddedModeratorIds) {
        if (!addedRecipients.has(userId) || userId === session.user.id) continue;
        notifications.push({
          userId,
          title: 'Назначение модератором',
          content: `Вас назначили модератором мероприятия «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.EVENT,
          read: false,
          metadata: { eventId: updated.id, action: 'moderator_added' }
        });
      }

      const changedFields = Object.keys(updateData);
      if (changedFields.length > 0) {
        const fieldLabels: Record<string, string> = {
          title: 'название',
          description: 'описание',
          location: 'место',
          duration: 'длительность',
          responsible: 'ответственный',
          contact: 'контакт',
          category: 'категория',
          maxParticipants: 'лимит участников',
          images: 'фотографии',
          date: 'дата',
          time: 'время'
        };
        const updatedFieldNames = changedFields
          .map(field => fieldLabels[field])
          .filter(Boolean);
        const changeSummary = updatedFieldNames.length > 0
          ? `Обновлены: ${updatedFieldNames.join(', ')}.`
          : 'Обновлены детали мероприятия.';

        const changeAudienceIds = new Set<string>();
        updated.eventParticipants.forEach(p => {
          if (p.user?.id) changeAudienceIds.add(p.user.id);
        });
        updated.moderators?.forEach(m => {
          if (m.user?.id) changeAudienceIds.add(m.user.id);
        });
        changeAudienceIds.delete(session.user.id);

        const changeRecipients = await loadChangeRecipients(Array.from(changeAudienceIds));
      for (const userId of Array.from(changeRecipients)) {
        notifications.push({
          userId,
          title: 'Изменение мероприятия',
          content: `Мероприятие «${updated.title}» было обновлено. ${changeSummary} Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.CHANGE,
            read: false,
            metadata: { eventId: updated.id, action: 'event_updated' }
          });
        }
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    } catch (notifyError) {
      console.error('Event update notifications error:', notifyError);
    }

    const beforeConfirmedParticipantEmails = event.eventParticipants
      .filter(participant => participant.status === ParticipantStatus.CONFIRMED)
      .map(participant => participant.user?.email)
      .filter((email): email is string => Boolean(email));
    const afterConfirmedParticipantEmails = confirmed
      .map(participant => participant?.email)
      .filter((email): email is string => Boolean(email));
    const addedParticipantEmails = afterConfirmedParticipantEmails
      .filter(email => !beforeConfirmedParticipantEmails.includes(email));
    const removedParticipantEmails = beforeConfirmedParticipantEmails
      .filter(email => !afterConfirmedParticipantEmails.includes(email));

    const beforeModeratorEmails = event.moderators
      .map(moderator => moderator.user?.email)
      .filter((email): email is string => Boolean(email));
    const afterModeratorEmails = updated.moderators
      .map(moderator => moderator.user?.email)
      .filter((email): email is string => Boolean(email));
    const addedModeratorEmails = afterModeratorEmails
      .filter(email => !beforeModeratorEmails.includes(email));
    const removedModeratorEmails = beforeModeratorEmails
      .filter(email => !afterModeratorEmails.includes(email));

    const updatedFields = Object.keys(updateData);
    const eventBeforeFields: Record<string, unknown> = {
      title: event.title,
      description: event.description,
      location: event.location,
      duration: event.duration,
      responsible: event.responsible,
      contact: event.contact,
      category: event.category,
      maxParticipants: event.maxParticipants,
      images: event.images,
      date: event.date,
      time: event.time,
      isNews: event.isNews,
      removedFromCalendar: event.removedFromCalendar
    };
    const eventAfterFields: Record<string, unknown> = {
      title: updated.title,
      description: updated.description,
      location: updated.location,
      duration: updated.duration,
      responsible: updated.responsible,
      contact: updated.contact,
      category: updated.category,
      maxParticipants: updated.maxParticipants,
      images: updated.images,
      date: updated.date,
      time: updated.time,
      isNews: updated.isNews,
      removedFromCalendar: updated.removedFromCalendar
    };
    const fieldChanges = buildFieldChanges(eventBeforeFields, eventAfterFields, updatedFields);

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_UPDATE",
      entityType: "Event",
      entityId: updated.id,
      metadata: {
        updatedFields,
        fieldChanges,
        participantsUpdated: confirmedParticipantIds !== null,
        participantChanges: {
          added: addedParticipantEmails,
          removed: removedParticipantEmails,
          totalBefore: beforeConfirmedParticipantEmails.length,
          totalAfter: afterConfirmedParticipantEmails.length
        },
        moderatorsUpdated: moderatorIds !== null,
        moderatorChanges: {
          added: addedModeratorEmails,
          removed: removedModeratorEmails,
          totalBefore: beforeModeratorEmails.length,
          totalAfter: afterModeratorEmails.length
        },
        eventInfoBefore: buildEventAuditInfo(
          event,
          beforeConfirmedParticipantEmails.length,
          beforeModeratorEmails.length
        ),
        eventInfo: buildEventAuditInfo(
          updated,
          afterConfirmedParticipantEmails.length,
          afterModeratorEmails.length
        )
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

