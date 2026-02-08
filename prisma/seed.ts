// prisma/seed.ts
import { PrismaClient, EventCategory, NotificationType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начало сидинга базы данных...')

  const allowReset = process.env.SEED_RESET === 'true'
  const existingUsers = await prisma.user.count()

  if (existingUsers > 0 && !allowReset) {
    console.log('ℹ️ Seed пропущен: база уже содержит данные. Установите SEED_RESET=true для полной пересборки.')
    return
  }

  if (existingUsers > 0 && allowReset) {
    console.log('⚠️ SEED_RESET=true: выполняется полная очистка базы данных.')
  }

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

  const consentAt = new Date()

  // Создание тестовых пользователей
  const hashedTeacherPassword = await bcrypt.hash('teacher', 10)
  const hashedStudentPassword = await bcrypt.hash('student', 10)

  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@bgitu.ru',
      name: 'Иван Петров',
      password: hashedTeacherPassword,
      role: 'TEACHER',
      department: 'Кафедра информационных технологий',
      privacyConsentAt: consentAt,
      termsConsentAt: consentAt
    }
  })

  const student = await prisma.user.create({
    data: {
      email: 'student@bgitu.ru',
      name: 'Мария Сидорова',
      password: hashedStudentPassword,
      role: 'STUDENT',
      group: 'ИС-21',
      privacyConsentAt: consentAt,
      termsConsentAt: consentAt
    }
  })

  // Администраторы (3 учётные записи)
  const adminSeedPassword =
    process.env.ADMIN_SEED_PASSWORD ||
    (process.env.NODE_ENV !== 'production' ? 'admin12345' : '')
  const adminSeedName = process.env.ADMIN_SEED_NAME || 'Администратор'

  if (adminSeedPassword) {
    const hashedAdminPassword = await bcrypt.hash(adminSeedPassword, 10)
    const adminEmails = ['admin1@bgitu.ru', 'admin2@bgitu.ru', 'admin3@bgitu.ru']

    await prisma.user.createMany({
      data: adminEmails.map((email, index) => ({
        email,
        name: adminSeedName.includes('{n}')
          ? adminSeedName.replace('{n}', String(index + 1))
          : adminSeedName,
        password: hashedAdminPassword,
        role: 'ADMIN',
        privacyConsentAt: consentAt,
        termsConsentAt: consentAt
      }))
    })
  } else {
    console.log('⚠️ ADMIN_SEED_PASSWORD не задан. Админы не созданы.')
  }

  // Создание тестовых мероприятий
  const makeDate = (daysFromNow: number, hours: number, minutes: number) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  const event1Date = makeDate(10, 10, 0)
  const event2Date = makeDate(30, 18, 0)
  const event3Date = makeDate(-60, 9, 0)

  await prisma.event.create({
    data: {
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
      creatorId: teacher.id,
      isPast: false,
      eventParticipants: {
        create: [
          {
            userId: student.id,
            status: 'CONFIRMED'
          }
        ]
      }
    }
  })

  await prisma.event.create({
    data: {
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
      creatorId: teacher.id,
      isPast: false
    }
  })

  const event3 = await prisma.event.create({
    data: {
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
      creatorId: teacher.id,
      isPast: true
    }
  })

  await prisma.eventReport.create({
    data: {
      eventId: event3.id,
      summary: 'Конференция прошла успешно, было представлено 25 докладов',
      tasks: ['Подготовка зала', 'Регистрация участников', 'Кофе-брейк'],
      reportDate: event3Date,
      activeParticipants: ['Иванов И.И.', 'Петрова А.А.', 'Сидоров С.С.'],
      images: []
    }
  })

  await prisma.notification.createMany({
    data: [
      {
        userId: student.id,
        title: 'Новое мероприятие',
        content: 'Создано новое мероприятие "День открытых дверей БГИТУ"',
        type: NotificationType.NEW,
        read: false
      },
      {
        userId: student.id,
        title: 'Напоминание',
        content: 'Завтра в 18:00 состоится концерт ко Дню студента',
        type: NotificationType.EVENT,
        read: true
      }
    ]
  })

  console.log('✅ Сидинг базы данных завершен!')
  console.log(`👨‍🏫 Преподаватель: teacher@bgitu.ru / teacher`)
  console.log(`👩‍🎓 Студент: student@bgitu.ru / student`)
  if (adminSeedPassword) {
    console.log(`🛠️ Админы: admin1@bgitu.ru, admin2@bgitu.ru, admin3@bgitu.ru`)
    if (process.env.NODE_ENV !== 'production') {
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
