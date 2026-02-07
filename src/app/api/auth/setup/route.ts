import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    // Проверяем, есть ли тестовые пользователи
    const teacher = await prisma.user.findUnique({
      where: { email: 'teacher@bgitu.ru' }
    });
    
    const student = await prisma.user.findUnique({
      where: { email: 'student@bgitu.ru' }
    });

    const admins = await prisma.user.findMany({
      where: { email: { in: ['admin1@bgitu.ru', 'admin2@bgitu.ru', 'admin3@bgitu.ru'] } },
      select: { id: true, email: true, role: true }
    });
    
    return NextResponse.json({
      success: true,
      users: {
        teacher: !!teacher,
        student: !!student,
        admins: admins.length,
        teacherDetails: teacher ? { id: teacher.id, role: teacher.role } : null,
        studentDetails: student ? { id: student.id, role: student.role } : null,
        adminDetails: admins
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    // Создаем тестовых пользователей если их нет
    const hashedTeacherPassword = await bcrypt.hash('teacher', 10);
    const hashedStudentPassword = await bcrypt.hash('student', 10);
    const consentAt = new Date();
    
    // Проверяем существующих
    const existingTeacher = await prisma.user.findUnique({
      where: { email: 'teacher@bgitu.ru' }
    });
    
    const existingStudent = await prisma.user.findUnique({
      where: { email: 'student@bgitu.ru' }
    });
    
    if (!existingTeacher) {
      await prisma.user.create({
        data: {
          email: 'teacher@bgitu.ru',
          name: 'Иван Петров',
          password: hashedTeacherPassword,
          role: 'TEACHER',
          department: 'Кафедра информационных технологий',
          privacyConsentAt: consentAt,
          termsConsentAt: consentAt
        }
      });
    }
    
    if (!existingStudent) {
      await prisma.user.create({
        data: {
          email: 'student@bgitu.ru',
          name: 'Мария Сидорова',
          password: hashedStudentPassword,
          role: 'STUDENT',
          group: 'ИС-21',
          privacyConsentAt: consentAt,
          termsConsentAt: consentAt
        }
      });
    }

    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'admin12345';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    const adminEmails = ['admin1@bgitu.ru', 'admin2@bgitu.ru', 'admin3@bgitu.ru'];
    const existingAdmins = await prisma.user.findMany({
      where: { email: { in: adminEmails } },
      select: { email: true }
    });
    const existingAdminEmails = new Set(existingAdmins.map(a => a.email));

    const adminsToCreate = adminEmails.filter(email => !existingAdminEmails.has(email));
    if (adminsToCreate.length > 0) {
      await prisma.user.createMany({
        data: adminsToCreate.map((email, index) => ({
          email,
          name: `Администратор ${index + 1}`,
          password: hashedAdminPassword,
          role: 'ADMIN',
          privacyConsentAt: consentAt,
          termsConsentAt: consentAt
        }))
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "Тестовые пользователи созданы/проверены",
      users: {
        teacher: 'teacher@bgitu.ru / teacher',
        student: 'student@bgitu.ru / student',
        admins: 'admin1@bgitu.ru / admin2@bgitu.ru / admin3@bgitu.ru'
      }
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
