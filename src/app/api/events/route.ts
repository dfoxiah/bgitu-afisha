// src/app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventCategory, NotificationType, ParticipantStatus, Prisma } from "@prisma/client";
import { buildAuditMeta, logAuditEvent } from "@/lib/audit";

// Простой кэш в памяти (без setInterval)
const requestCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_DURATION = 5000; // 5 секунд

const debugLog = (...args: unknown[]) => {
  if (process.env.DEBUG_EVENTS === 'true') {
    console.log(...args);
  }
};

// Функция для очистки устаревшего кэша
function cleanupCache() {
  const now = Date.now();
  const entries = Array.from(requestCache.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
    }
  }
}

// Вспомогательная функция для безопасного парсинга даты и времени (локальное время)
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

// Вспомогательная функция для проверки категории
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

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    debugLog('GET /api/events - Starting request...');
    
    // Очищаем устаревший кэш
    cleanupCache();
    
    const session = await getServerSession(authOptions);
    
    debugLog('GET /api/events - Session info:', {
      hasSession: !!session,
      userEmail: session?.user?.email,
      userId: session?.user?.id,
      userRole: session?.user?.role
    });
    
    // Получаем параметры запроса
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category");
    const search = searchParams.get("search");
    const upcomingParam = searchParams.get("upcoming");
    const limitParam = searchParams.get("limit");
    const pastParam = searchParams.get("past");
    
    // Создаем ключ кэша на основе параметров и сессии
    const cacheKey = JSON.stringify({
      userId: session?.user?.id || 'anonymous',
      category: categoryParam,
      search,
      upcoming: upcomingParam,
      past: pastParam,
      limit: limitParam,
      url: req.url
    });
    
    // Проверяем кэш
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      debugLog('GET /api/events - Returning cached response');
      return NextResponse.json(cached.data);
    }
    
    // Строим условие для запроса
    const where: any = {
      removedFromCalendar: false
    };
    
    // Фильтр по категории
    if (categoryParam && isValidCategory(categoryParam)) {
      where.category = categoryParam as EventCategory;
      debugLog('GET /api/events - Filtering by category:', categoryParam);
    }
    
    // Фильтр по текстовому поиску
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { responsible: { contains: search, mode: 'insensitive' } }
      ];
      debugLog('GET /api/events - Searching for:', search);
    }
    
    // Фильтр по статусу мероприятия
    const now = new Date();
    if (upcomingParam === "true") {
      where.isPast = false;
      where.date = { gte: now };
      debugLog('GET /api/events - Filtering upcoming events');
    } else if (pastParam === "true") {
      where.isPast = true;
      debugLog('GET /api/events - Filtering past events');
    } else if (!session?.user?.id) {
      // Для неавторизованных пользователей показываем только будущие события
      where.isPast = false;
      where.date = { gte: now };
      debugLog('GET /api/events - Unauthorized user, showing only upcoming events');
    }
    
    // Ограничение количества записей
    const limit = limitParam ? parseInt(limitParam) : undefined;
    if (limit) {
      debugLog('GET /api/events - Limiting to', limit, 'events');
    }
    
    debugLog('GET /api/events - Database query conditions:', JSON.stringify(where, null, 2));
    
    // Выполняем запрос к базе данных
    const events = await prisma.event.findMany({
      where,
      include: {
        report: {
          select: {
            id: true,
            summary: true,
            tasks: true,
            comment: true,
            reportDate: true,
            activeParticipants: true,
            images: true,
            createdAt: true,
            updatedAt: true
          }
        },
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
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            group: true,
            image: true
          }
        },
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
      },
      orderBy: { date: 'asc' },
      take: limit
    });
    
    debugLog(`GET /api/events - Found ${events.length} events`);
    
    // Сериализуем события для ответа
    const serializedEvents = events.map(event => {
      const { confirmed, pending } = splitParticipants(event.eventParticipants);
      const confirmedCount = confirmed.length;

      return ({
      id: event.id,
      title: event.title,
      category: event.category,
      date: event.date.toISOString(),
      time: event.time,
      duration: event.duration,
      location: event.location,
      description: event.description,
      maxParticipants: event.maxParticipants,
      currentParticipants: confirmedCount,
      isPast: event.isPast,
      removedFromCalendar: event.removedFromCalendar,
      isNews: event.isNews,
      images: event.images,
      responsible: event.responsible,
      contact: event.contact,
      creatorId: event.creatorId,
      creator: event.creator,
      moderators: event.moderators?.map(m => m.user) || [],
      participants: confirmed,
      pendingParticipants: pending,
      report: event.report ? {
        ...event.report,
        reportDate: event.report.reportDate.toISOString(),
        createdAt: event.report.createdAt.toISOString(),
        updatedAt: event.report.updatedAt.toISOString()
      } : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
      });
    });
    
    // Сохраняем в кэш
    requestCache.set(cacheKey, {
      timestamp: Date.now(),
      data: serializedEvents
    });
    
    // Настраиваем заголовки ответа
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      'X-Total-Count': events.length.toString()
    };
    
    // Если пользователь авторизован, добавляем информацию о сессии
    if (session?.user) {
      Object.assign(headers, {
        'X-User-Id': session.user.id,
        'X-User-Role': session.user.role
      });
    }
    
    return NextResponse.json(serializedEvents, { headers });
    
  } catch (error) {
    console.error("GET /api/events - Error fetching events:", error);
    
    // Возвращаем пустой массив вместо ошибки для предотвращения сбоев на клиенте
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    debugLog('POST /api/events - Starting request...');
    
    // Очищаем кэш при создании нового события
    requestCache.clear();
    
    const session = await getServerSession(authOptions);
    
    debugLog('POST /api/events - Session info:', {
      hasSession: !!session,
      userEmail: session?.user?.email,
      userId: session?.user?.id,
      userRole: session?.user?.role
    });
    
    // Проверяем авторизацию
    if (!session?.user?.id) {
      debugLog('POST /api/events - Unauthorized request');
      return NextResponse.json(
        { 
          error: "Не авторизован",
          code: "UNAUTHORIZED"
        },
        { status: 401 }
      );
    }
    
    // Проверяем права доступа (только преподаватели и администраторы)
    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      debugLog('POST /api/events - Insufficient permissions:', session.user.role);
      return NextResponse.json(
        { 
          error: "Недостаточно прав. Только преподаватели и администраторы могут создавать мероприятия.",
          code: "FORBIDDEN"
        },
        { status: 403 }
      );
    }
    
    // Парсим тело запроса
    let body: any;
    try {
      body = await req.json();
      debugLog('POST /api/events - Request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('POST /api/events - Error parsing request body:', parseError);
      return NextResponse.json(
        { 
          error: "Неверный формат данных",
          code: "INVALID_JSON"
        },
        { status: 400 }
      );
    }
    
    // Валидация обязательных полей
    const requiredFields = ['title', 'category', 'date', 'location', 'description'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      debugLog('POST /api/events - Missing required fields:', missingFields);
      return NextResponse.json(
        { 
          error: `Заполните все обязательные поля: ${missingFields.join(', ')}`,
          code: "VALIDATION_ERROR",
          missingFields
        },
        { status: 400 }
      );
    }
    
    // Проверка категории
    if (!isValidCategory(body.category)) {
      debugLog('POST /api/events - Invalid category:', body.category);
      return NextResponse.json(
        { 
          error: `Недопустимая категория: ${body.category}`,
          code: "INVALID_CATEGORY",
          validCategories: Object.values(EventCategory)
        },
        { status: 400 }
      );
    }
    
    // Парсинг даты и времени
    const timeValue = typeof body.time === 'string' ? body.time.trim() : '';
    const normalizedTime = timeValue || "14:00";
    const eventDate = parseDateTime(body.date, normalizedTime);
    if (!eventDate) {
      debugLog('POST /api/events - Invalid date:', body.date);
      return NextResponse.json(
        { 
          error: "Неверный формат даты",
          code: "INVALID_DATE"
        },
        { status: 400 }
      );
    }

    // Проверяем, что пользователь-creator существует в БД
    let creator = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!creator && session.user.email) {
      creator = await prisma.user.findUnique({
        where: { email: session.user.email }
      });
    }

    if (!creator) {
      debugLog('POST /api/events - Creator not found for session user');
      return NextResponse.json(
        { 
          error: "Пользователь не найден. Перелогиньтесь и попробуйте снова.",
          code: "CREATOR_NOT_FOUND"
        },
        { status: 401 }
      );
    }
    const creatorId = creator.id;

    // Проверяем, не в прошлом ли дата
    const now = new Date();
    if (eventDate < now) {
      debugLog('POST /api/events - Date in the past:', eventDate);
      return NextResponse.json(
        { 
          error: "Дата мероприятия не может быть в прошлом",
          code: "PAST_DATE"
        },
        { status: 400 }
      );
    }

    // Обрабатываем участников (email -> userId)
    const participantEmails = Array.isArray(body.participants)
      ? (body.participants as unknown[])
          .map(value => String(value).trim())
          .filter((email): email is string => Boolean(email))
      : [];
    const uniqueParticipantEmails = Array.from(new Set<string>(participantEmails));

    let participantsToConnect: Array<{ id: string }> = [];
    if (uniqueParticipantEmails.length > 0) {
      const participantUsers = await prisma.user.findMany({
        where: { email: { in: uniqueParticipantEmails } },
        select: { id: true, email: true }
      });

      const foundEmails = new Set(participantUsers.map(u => u.email));
      const missingEmails = uniqueParticipantEmails.filter(email => !foundEmails.has(email));

      if (missingEmails.length > 0) {
        return NextResponse.json(
          {
            error: `Не найдены участники: ${missingEmails.join(', ')}`,
            code: "PARTICIPANTS_NOT_FOUND"
          },
          { status: 400 }
        );
      }

      participantsToConnect = participantUsers.map(u => ({ id: u.id }));
    }

    if (body.maxParticipants && participantsToConnect.length > Number(body.maxParticipants)) {
      return NextResponse.json(
        {
          error: "Количество участников превышает лимит",
          code: "PARTICIPANTS_OVER_LIMIT"
        },
        { status: 400 }
      );
    }

    // Обрабатываем список модераторов (дополнительные преподаватели)
    const moderatorEmails = Array.isArray(body.moderators)
      ? (body.moderators as unknown[])
          .map(value => String(value).trim())
          .filter((email): email is string => Boolean(email))
      : [];
    const uniqueModeratorEmails = Array.from(new Set<string>(moderatorEmails));

    let moderatorsToConnect: Array<{ userId: string }> = [];
    if (uniqueModeratorEmails.length > 0) {
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

      moderatorsToConnect = moderatorUsers
        .filter(u => u.id !== creatorId)
        .map(u => ({ userId: u.id }));
    }
    
    // Подготавливаем данные для создания
    const confirmedParticipants = participantsToConnect.map(p => ({
      userId: p.id,
      status: ParticipantStatus.CONFIRMED
    }));

    const eventData = {
      title: body.title.trim(),
      category: body.category as EventCategory,
      date: eventDate,
      time: normalizedTime,
      duration: body.duration?.trim() || "2 часа",
      location: body.location.trim(),
      description: body.description.trim(),
      maxParticipants: body.maxParticipants ? parseInt(body.maxParticipants) : 0,
      currentParticipants: confirmedParticipants.length,
      isPast: false,
      removedFromCalendar: false,
      isNews: body.isNews || false,
      images: Array.isArray(body.images) ? body.images : [],
      responsible: body.responsible?.trim() || session.user.name || "Не указан",
      contact: body.contact?.trim() || session.user.email || "",
      creatorId: creatorId,
      ...(moderatorsToConnect.length > 0
        ? { moderators: { createMany: { data: moderatorsToConnect, skipDuplicates: true } } }
        : {}),
      ...(confirmedParticipants.length > 0 ? { eventParticipants: { create: confirmedParticipants } } : {})
    };
    
    debugLog('POST /api/events - Creating event with data:', JSON.stringify(eventData, null, 2));
    
    // Создаем мероприятие в базе данных
    const newEvent = await prisma.event.create({
      data: eventData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            group: true
          }
        },
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
    
    debugLog('POST /api/events - Event created successfully:', newEvent.id);

    const { ip, userAgent } = buildAuditMeta(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_CREATE",
      entityType: "Event",
      entityId: newEvent.id,
      metadata: {
        title: newEvent.title,
        moderators: moderatorEmails
      },
      ip,
      userAgent
    });

    try {
      const eventDateText = new Date(newEvent.date).toLocaleDateString('ru-RU');
      const timeText = newEvent.time ? ` ${newEvent.time}` : '';
      const locationText = newEvent.location ? `, место: ${newEvent.location}` : '';
      const participantIds = participantsToConnect.map(p => p.id);
      const moderatorIds = moderatorsToConnect.map(m => m.userId);

      const notifications: Prisma.NotificationCreateManyInput[] = [];

      const changeRecipients = await prisma.user.findMany({
        where: {
          id: { in: [...participantIds, ...moderatorIds] },
          notifyChanges: true
        },
        select: { id: true }
      });
      const changeRecipientIds = new Set(changeRecipients.map(user => user.id));

      for (const userId of participantIds) {
        if (!changeRecipientIds.has(userId)) continue;
        notifications.push({
          userId,
          title: 'Добавление в мероприятие',
          content: `Вас добавили в мероприятие «${newEvent.title}». Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.EVENT,
          read: false,
          metadata: { eventId: newEvent.id, action: 'participant_added' }
        });
      }

      for (const userId of moderatorIds) {
        if (!changeRecipientIds.has(userId)) continue;
        notifications.push({
          userId,
          title: 'Назначение модератором',
          content: `Вас назначили модератором мероприятия «${newEvent.title}». Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.EVENT,
          read: false,
          metadata: { eventId: newEvent.id, action: 'moderator_added' }
        });
      }

      const excludedIds = new Set<string>([creatorId, ...participantIds, ...moderatorIds]);
      const audienceWhere: any = {
        id: { notIn: Array.from(excludedIds) },
        OR: [
          { notificationCategories: { isEmpty: true } },
          { notificationCategories: { has: newEvent.category } }
        ]
      };

      if (newEvent.isNews || newEvent.category === EventCategory.NEWS) {
        audienceWhere.notifyNews = true;
      } else {
        audienceWhere.notifyNewEvents = true;
      }

      const audience = await prisma.user.findMany({
        where: audienceWhere,
        select: { id: true }
      });

      const newEventTitle = newEvent.isNews || newEvent.category === EventCategory.NEWS
        ? 'Новая новость'
        : 'Новое мероприятие';
      const newEventContent = newEvent.isNews || newEvent.category === EventCategory.NEWS
        ? `Новая новость: «${newEvent.title}». ${eventDateText}${timeText}`
        : `Новое мероприятие: «${newEvent.title}». Дата: ${eventDateText}${timeText}${locationText}`;

      for (const recipient of audience) {
        notifications.push({
          userId: recipient.id,
          title: newEventTitle,
          content: newEventContent,
          type: NotificationType.NEW,
          read: false,
          metadata: { eventId: newEvent.id, action: 'event_new' }
        });
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    } catch (notifyError) {
      console.error('Event notifications error:', notifyError);
    }
    
    // Сериализуем ответ
    const { confirmed, pending } = splitParticipants(newEvent.eventParticipants);
    const serializedEvent = {
      ...newEvent,
      currentParticipants: confirmed.length,
      participants: confirmed,
      pendingParticipants: pending,
      moderators: newEvent.moderators?.map(m => m.user) || [],
      date: newEvent.date.toISOString(),
      createdAt: newEvent.createdAt.toISOString(),
      updatedAt: newEvent.updatedAt.toISOString()
    };
    
    return NextResponse.json(serializedEvent, { 
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Location': `/api/events/${newEvent.id}`,
        'X-Event-Id': newEvent.id
      }
    });
    
  } catch (error) {
    console.error("POST /api/events - Error creating event:", error);
    
    // Определяем тип ошибки
    let statusCode = 500;
    let errorMessage = "Ошибка сервера при создании мероприятия";
    let errorCode = "SERVER_ERROR";
    
    if (error instanceof Error) {
      // Ошибки базы данных
      if (error.message.includes('Unique constraint')) {
        statusCode = 409;
        errorMessage = "Мероприятие с таким названием уже существует";
        errorCode = "DUPLICATE_EVENT";
      } else if (error.message.includes('Foreign key constraint')) {
        statusCode = 400;
        errorMessage = "Неверный идентификатор создателя";
        errorCode = "INVALID_CREATOR";
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
      },
      { 
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

