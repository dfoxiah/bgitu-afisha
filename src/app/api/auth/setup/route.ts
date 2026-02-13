/**
 * File responsibility:
 * Bootstrap endpoint for local auth seed/setup tasks.
 *
 * Main logic:
 * - Create/update baseline accounts for development.
 * - Return setup status and diagnostics.
 *
 * Integrations:
 * - Prisma User model
 * - Local test/smoke initialization
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || 'MainTeacher2026@bgitu.ru';
    const defaultAdminEmails = [
      'AdminNovaQ7K3Z9X@bgitu.ru',
      'AdminNovaQ7K3Z9Y@bgitu.ru',
      'AdminNovaQ7K3Z9Z@bgitu.ru'
    ];
    const adminEmails = (process.env.ADMIN_SEED_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    const resolvedAdminEmails = adminEmails.length > 0 ? adminEmails : defaultAdminEmails;

    // Проверяем, есть ли тестовые пользователи
    const teacher = await prisma.user.findUnique({
      where: { email: teacherSeedEmail }
    });
    
    const student = await prisma.user.findUnique({
      where: { email: 'student@bgitu.ru' }
    });

    const admins = await prisma.user.findMany({
      where: { email: { in: resolvedAdminEmails } },
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
    const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || 'MainTeacher2026@bgitu.ru';
    const teacherSeedPassword = process.env.TEACHER_SEED_PASSWORD || 'T9mW2pK7sL8xQ4cN';
    const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD || 'R5mQ9tX2sL7pV8cN';
    const adminSeedName = process.env.ADMIN_SEED_NAME;
    const defaultAdminEmails = [
      'AdminNovaQ7K3Z9X@bgitu.ru',
      'AdminNovaQ7K3Z9Y@bgitu.ru',
      'AdminNovaQ7K3Z9Z@bgitu.ru'
    ];
    const adminEmails = (process.env.ADMIN_SEED_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    const resolvedAdminEmails = adminEmails.length > 0 ? adminEmails : defaultAdminEmails;

    // Создаем тестовых пользователей если их нет
    const hashedTeacherPassword = await bcrypt.hash(teacherSeedPassword, 10);
    const hashedStudentPassword = await bcrypt.hash('student', 10);
    const consentAt = new Date();
    
    // Проверяем существующих
    const existingTeacher = await prisma.user.findUnique({
      where: { email: teacherSeedEmail }
    });
    
    const existingStudent = await prisma.user.findUnique({
      where: { email: 'student@bgitu.ru' }
    });
    
    if (!existingTeacher) {
      await prisma.user.create({
        data: {
          email: teacherSeedEmail,
          name: 'Main Teacher',
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

    const hashedAdminPassword = await bcrypt.hash(adminSeedPassword, 10);
    const existingAdmins = await prisma.user.findMany({
      where: { email: { in: resolvedAdminEmails } },
      select: { email: true }
    });
    const existingAdminEmails = new Set(existingAdmins.map(a => a.email));

    const adminsToCreate = resolvedAdminEmails.filter(email => !existingAdminEmails.has(email));
    if (adminsToCreate.length > 0) {
      await prisma.user.createMany({
        data: adminsToCreate.map((email, index) => ({
          email,
          name: adminSeedName
            ? (adminSeedName.includes('{n}')
              ? adminSeedName.replace('{n}', String(index + 1))
              : adminSeedName)
            : email.split('@')[0],
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
        teacher: `${teacherSeedEmail} / ${teacherSeedPassword}`,
        student: 'student@bgitu.ru / student',
        admins: resolvedAdminEmails.join(' / ')
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
