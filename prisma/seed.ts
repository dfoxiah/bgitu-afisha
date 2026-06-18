// prisma/seed.ts
import { PrismaClient, EventCategory, NotificationType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from '../src/lib/profile-completion'

const prisma = new PrismaClient()
const studentSeedEmail = 'student@bgitu.ru'
const studentSeedDepartment = 'ФИТ'
const studentSeedAdmissionYear = 2024
const teacherSeedDepartment = 'Кафедра информационных технологий'
const adminSeedDepartment = 'Администрация БГИТУ'
const defaultAdminEmails = ['admin1@bgitu.ru', 'admin2@bgitu.ru', 'admin3@bgitu.ru']
const isProduction = process.env.NODE_ENV === 'production'
const allowPasswordLogging = process.env.SEED_LOG_PASSWORDS === 'true'

const readDevOnlyPassword = (envName: string, fallback: string) => {
  const configured = process.env[envName]?.trim()
  if (configured) return configured
  return isProduction ? '' : fallback
}

async function main() {
  console.log('🌱 Начало сидинга базы данных...')

  const allowReset = process.env.SEED_RESET === 'true'
  const allowPasswordUpdate = process.env.SEED_UPDATE_PASSWORDS === 'true'

  if (allowReset) {
    console.log('⚠️ SEED_RESET=true: выполняется полная очистка базы данных.')
    // Очистка существующих данных (в правильном порядке)
    await prisma.auditLog.deleteMany()
    await prisma.eventModerator.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.eventReport.deleteMany()
    await prisma.eventParticipant.deleteMany()
    await prisma.event.deleteMany()
    await prisma.account.deleteMany()
    await prisma.session.deleteMany()
    await prisma.verificationToken.deleteMany()
    await prisma.user.deleteMany()
  } else {
    console.log('ℹ️ Seed работает в режиме добавления (без очистки данных).')
  }

  const consentAt = new Date()

  // Создание тестовых пользователей
  const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || 'MainTeacher2026@bgitu.ru'
  const teacherSeedPassword = readDevOnlyPassword('TEACHER_SEED_PASSWORD', 'T9mW2pK7sL8xQ4cN')
  const studentSeedPassword = readDevOnlyPassword('STUDENT_SEED_PASSWORD', 'student')
  const hashedTeacherPassword = teacherSeedPassword ? await bcrypt.hash(teacherSeedPassword, 10) : null
  const hashedStudentPassword = studentSeedPassword ? await bcrypt.hash(studentSeedPassword, 10) : null

  const existingTeacher = await prisma.user.findUnique({
    where: { email: teacherSeedEmail }
  })

  const teacher = existingTeacher
    ? await prisma.user.update({
        where: { email: teacherSeedEmail },
        data: {
          name: existingTeacher.name || 'Main Teacher',
          role: 'TEACHER',
          department: existingTeacher.department || teacherSeedDepartment,
          privacyConsentAt: existingTeacher.privacyConsentAt || consentAt,
          privacyConsentVersion:
            existingTeacher.privacyConsentVersion || PRIVACY_POLICY_VERSION,
          termsConsentAt: existingTeacher.termsConsentAt || consentAt,
          termsConsentVersion: existingTeacher.termsConsentVersion || TERMS_VERSION,
          consentSource: existingTeacher.consentSource || 'seed',
          profileCompletedAt: existingTeacher.profileCompletedAt || consentAt,
          ...((allowPasswordUpdate || !existingTeacher.password) && hashedTeacherPassword
            ? { password: hashedTeacherPassword }
            : {})
        }
      })
    : await prisma.user.create({
        data: {
          email: teacherSeedEmail,
          name: 'Main Teacher',
          ...(hashedTeacherPassword ? { password: hashedTeacherPassword } : {}),
          role: 'TEACHER',
          department: teacherSeedDepartment,
          privacyConsentAt: consentAt,
          privacyConsentVersion: PRIVACY_POLICY_VERSION,
          termsConsentAt: consentAt,
          termsConsentVersion: TERMS_VERSION,
          consentSource: 'seed',
          profileCompletedAt: consentAt
        }
      })

  const existingStudent = await prisma.user.findUnique({
    where: { email: studentSeedEmail }
  })

  const student = existingStudent
    ? await prisma.user.update({
        where: { email: studentSeedEmail },
        data: {
          name: existingStudent.name || 'Мария Сидорова',
          role: 'STUDENT',
          department: existingStudent.department || studentSeedDepartment,
          group: existingStudent.group || 'ИС-21',
          admissionYear: existingStudent.admissionYear || studentSeedAdmissionYear,
          privacyConsentAt: existingStudent.privacyConsentAt || consentAt,
          privacyConsentVersion:
            existingStudent.privacyConsentVersion || PRIVACY_POLICY_VERSION,
          termsConsentAt: existingStudent.termsConsentAt || consentAt,
          termsConsentVersion: existingStudent.termsConsentVersion || TERMS_VERSION,
          consentSource: existingStudent.consentSource || 'seed',
          profileCompletedAt: existingStudent.profileCompletedAt || consentAt,
          ...((allowPasswordUpdate || !existingStudent.password) && hashedStudentPassword
            ? { password: hashedStudentPassword }
            : {})
        }
      })
    : await prisma.user.create({
        data: {
          email: studentSeedEmail,
          name: 'Мария Сидорова',
          ...(hashedStudentPassword ? { password: hashedStudentPassword } : {}),
          role: 'STUDENT',
          department: studentSeedDepartment,
          group: 'ИС-21',
          admissionYear: studentSeedAdmissionYear,
          privacyConsentAt: consentAt,
          privacyConsentVersion: PRIVACY_POLICY_VERSION,
          termsConsentAt: consentAt,
          termsConsentVersion: TERMS_VERSION,
          consentSource: 'seed',
          profileCompletedAt: consentAt
        }
      })

  // Администраторы (3 учётные записи)
  const adminSeedPassword = readDevOnlyPassword('ADMIN_SEED_PASSWORD', 'R5mQ9tX2sL7pV8cN')
  const adminSeedName = process.env.ADMIN_SEED_NAME
  const adminEmails = (process.env.ADMIN_SEED_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
  const resolvedAdminEmails = adminEmails.length > 0 ? adminEmails : defaultAdminEmails

  if (adminSeedPassword) {
    const hashedAdminPassword = await bcrypt.hash(adminSeedPassword, 10)

    for (let index = 0; index < resolvedAdminEmails.length; index += 1) {
      const email = resolvedAdminEmails[index]
      const existingAdmin = await prisma.user.findUnique({ where: { email } })
      const name = adminSeedName
        ? (adminSeedName.includes('{n}')
          ? adminSeedName.replace('{n}', String(index + 1))
          : adminSeedName)
        : email.split('@')[0]

      if (!existingAdmin) {
        await prisma.user.create({
          data: {
            email,
            name,
            password: hashedAdminPassword,
            role: 'ADMIN',
            department: adminSeedDepartment,
            privacyConsentAt: consentAt,
            privacyConsentVersion: PRIVACY_POLICY_VERSION,
            termsConsentAt: consentAt,
            termsConsentVersion: TERMS_VERSION,
            consentSource: 'seed',
            profileCompletedAt: consentAt
          }
        })
      } else {
        await prisma.user.update({
          where: { email },
          data: {
            name: existingAdmin.name || name,
            role: 'ADMIN',
            department: existingAdmin.department || adminSeedDepartment,
            privacyConsentAt: existingAdmin.privacyConsentAt || consentAt,
            privacyConsentVersion:
              existingAdmin.privacyConsentVersion || PRIVACY_POLICY_VERSION,
            termsConsentAt: existingAdmin.termsConsentAt || consentAt,
            termsConsentVersion: existingAdmin.termsConsentVersion || TERMS_VERSION,
            consentSource: existingAdmin.consentSource || 'seed',
            profileCompletedAt: existingAdmin.profileCompletedAt || consentAt,
            ...(allowPasswordUpdate || !existingAdmin.password
              ? { password: hashedAdminPassword }
              : {})
          }
        })
      }
    }
  } else {
    console.log('⚠️ ADMIN_SEED_PASSWORD не задан. Админы не созданы.')
  }

  const makeDate = (daysFromNow: number, hours: number, minutes: number) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  const event1Date = makeDate(10, 10, 0)
  const event2Date = makeDate(30, 18, 0)
  const event3Date = makeDate(-60, 9, 0)

  const ensureSeedEvent = async (params: {
    title: string
    category: EventCategory
    date: Date
    time: string
    duration: string
    location: string
    description: string
    maxParticipants: number
    currentParticipants: number
    responsible: string
    contact: string
    isPast: boolean
  }) => {
    const existingEvent = await prisma.event.findFirst({
      where: {
        title: params.title,
        creatorId: teacher.id,
      },
      select: { id: true },
    })

    if (existingEvent) {
      return prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          category: params.category,
          date: params.date,
          time: params.time,
          duration: params.duration,
          location: params.location,
          description: params.description,
          maxParticipants: params.maxParticipants,
          currentParticipants: params.currentParticipants,
          responsible: params.responsible,
          contact: params.contact,
          isPast: params.isPast,
          removedFromCalendar: false,
          isPublic: true,
        },
      })
    }

    return prisma.event.create({
      data: {
        title: params.title,
        category: params.category,
        date: params.date,
        time: params.time,
        duration: params.duration,
        location: params.location,
        description: params.description,
        maxParticipants: params.maxParticipants,
        currentParticipants: params.currentParticipants,
        responsible: params.responsible,
        contact: params.contact,
        creatorId: teacher.id,
        isPast: params.isPast,
      },
    })
  }

  const event1 = await ensureSeedEvent({
    title: 'День открытых дверей БГИТУ',
    category: EventCategory.PUBLIC_EVENT,
    date: event1Date,
    time: '10:00 - 14:00',
    duration: '4 часа',
    location: 'Главный корпус, ауд. 301',
    description: 'Приглашаем абитуриентов и их родителей на день открытых дверей БГИТУ.',
    maxParticipants: 150,
    currentParticipants: 1,
    responsible: 'Иванов И.И.',
    contact: 'i.ivanov@bgitu.ru',
    isPast: false,
  })

  await prisma.eventParticipant.upsert({
    where: {
      eventId_userId: {
        eventId: event1.id,
        userId: student.id,
      },
    },
    update: {
      status: 'CONFIRMED',
    },
    create: {
      eventId: event1.id,
      userId: student.id,
      status: 'CONFIRMED',
    },
  })
  await prisma.event.update({
    where: { id: event1.id },
    data: { currentParticipants: 1 },
  })

  await ensureSeedEvent({
    title: 'Концерт ко Дню студента',
    category: EventCategory.CONCERT,
    date: event2Date,
    time: '18:00 - 21:00',
    duration: '3 часа',
    location: 'Актовый зал',
    description: 'Ежегодный концерт, посвященный Дню студента',
    maxParticipants: 300,
    currentParticipants: 0,
    responsible: 'Петрова А.А.',
    contact: 'a.petrova@bgitu.ru',
    isPast: false,
  })

  const event3 = await ensureSeedEvent({
    title: 'Научная конференция "Инновации-2024"',
    category: EventCategory.LECTURE,
    date: event3Date,
    time: '09:00 - 18:00',
    duration: '8 часов',
    location: 'Конференц-зал',
    description: 'Ежегодная научная конференция с участием ведущих специалистов',
    maxParticipants: 200,
    currentParticipants: 0,
    responsible: 'Сидоров С.С.',
    contact: 's.sidorov@bgitu.ru',
    isPast: true,
  })

  const existingReport = await prisma.eventReport.findUnique({
    where: { eventId: event3.id },
    select: { id: true },
  })
  if (existingReport) {
    await prisma.eventReport.update({
      where: { eventId: event3.id },
      data: {
        summary: 'Конференция прошла успешно, было представлено 25 докладов',
        tasks: ['Подготовка зала', 'Регистрация участников', 'Кофе-брейк'],
        reportDate: event3Date,
        activeParticipants: ['Иванов И.И.', 'Петрова А.А.', 'Сидоров С.С.'],
        images: [],
      },
    })
  } else {
    await prisma.eventReport.create({
      data: {
        eventId: event3.id,
        summary: 'Конференция прошла успешно, было представлено 25 докладов',
        tasks: ['Подготовка зала', 'Регистрация участников', 'Кофе-брейк'],
        reportDate: event3Date,
        activeParticipants: ['Иванов И.И.', 'Петрова А.А.', 'Сидоров С.С.'],
        images: [],
      },
    })
  }

  const existingNotifications = await prisma.notification.count({
    where: {
      userId: student.id,
      title: { in: ['Новое мероприятие', 'Напоминание'] },
    },
  })
  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: student.id,
          title: 'Новое мероприятие',
          content: 'Создано новое мероприятие "День открытых дверей БГИТУ"',
          type: NotificationType.NEW,
          read: false,
        },
        {
          userId: student.id,
          title: 'Напоминание',
          content: 'Завтра в 18:00 состоится концерт ко Дню студента',
          type: NotificationType.EVENT,
          read: true,
        },
      ],
    })
  }

  console.log('✅ Сидинг базы данных завершен!')
  console.log(`👨‍🏫 Преподаватель: ${teacherSeedEmail}`)
  console.log(`👩‍🎓 Студент: ${studentSeedEmail}`)
  if (allowPasswordLogging) {
    if (teacherSeedPassword) {
      console.log(`🔐 Пароль преподавателя (dev): ${teacherSeedPassword}`)
    }
    if (studentSeedPassword) {
      console.log(`🔐 Пароль студента (dev): ${studentSeedPassword}`)
    }
  }
  if (adminSeedPassword) {
    console.log(`🛠️ Админы: ${resolvedAdminEmails.join(', ')}`)
    if (!isProduction && allowPasswordLogging) {
      console.log(`🔐 Пароль админов (dev): ${adminSeedPassword}`)
    }
  }
  console.log(`📅 Создано мероприятий: 3`)
  console.log(`🔔 Создано уведомлений: 2`)
}

main()
  .catch((error) => {
    console.error('Seed error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
