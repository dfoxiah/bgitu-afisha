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
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/profile-completion";

const studentSeedEmail = "student@bgitu.ru";
const studentSeedDepartment = "ФИТ";
const studentSeedAdmissionYear = 2024;
const teacherSeedDepartment = "Кафедра информационных технологий";
const adminSeedDepartment = "Администрация БГИТУ";
const defaultAdminEmails = ["admin1@bgitu.ru", "admin2@bgitu.ru", "admin3@bgitu.ru"];

export async function GET(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || 'MainTeacher2026@bgitu.ru';
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
      where: { email: studentSeedEmail }
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
    const adminEmails = (process.env.ADMIN_SEED_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    const resolvedAdminEmails = adminEmails.length > 0 ? adminEmails : defaultAdminEmails;

    // Создаем тестовых пользователей если их нет
    const hashedTeacherPassword = await bcrypt.hash(teacherSeedPassword, 10);
    const hashedStudentPassword = await bcrypt.hash('student', 10);
    const consentAt = new Date();

    const existingTeacher = await prisma.user.findUnique({
      where: { email: teacherSeedEmail }
    });
    const existingStudent = await prisma.user.findUnique({
      where: { email: studentSeedEmail }
    });

    await prisma.user.upsert({
      where: { email: teacherSeedEmail },
      update: {
        name: existingTeacher?.name || 'Main Teacher',
        password: hashedTeacherPassword,
        role: 'TEACHER',
        department: existingTeacher?.department || teacherSeedDepartment,
        privacyConsentAt: existingTeacher?.privacyConsentAt || consentAt,
        privacyConsentVersion:
          existingTeacher?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
        termsConsentAt: existingTeacher?.termsConsentAt || consentAt,
        termsConsentVersion:
          existingTeacher?.termsConsentVersion || TERMS_VERSION,
        consentSource: existingTeacher?.consentSource || 'setup',
        profileCompletedAt: existingTeacher?.profileCompletedAt || consentAt,
      },
      create: {
        email: teacherSeedEmail,
        name: 'Main Teacher',
        password: hashedTeacherPassword,
        role: 'TEACHER',
        department: teacherSeedDepartment,
        privacyConsentAt: consentAt,
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        termsConsentAt: consentAt,
        termsConsentVersion: TERMS_VERSION,
        consentSource: 'setup',
        profileCompletedAt: consentAt,
      }
    });

    await prisma.user.upsert({
      where: { email: studentSeedEmail },
      update: {
        name: existingStudent?.name || 'Мария Сидорова',
        password: hashedStudentPassword,
        role: 'STUDENT',
        department: existingStudent?.department || studentSeedDepartment,
        group: existingStudent?.group || 'ИС-21',
        admissionYear: existingStudent?.admissionYear || studentSeedAdmissionYear,
        privacyConsentAt: existingStudent?.privacyConsentAt || consentAt,
        privacyConsentVersion:
          existingStudent?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
        termsConsentAt: existingStudent?.termsConsentAt || consentAt,
        termsConsentVersion:
          existingStudent?.termsConsentVersion || TERMS_VERSION,
        consentSource: existingStudent?.consentSource || 'setup',
        profileCompletedAt: existingStudent?.profileCompletedAt || consentAt,
      },
      create: {
        email: studentSeedEmail,
        name: 'Мария Сидорова',
        password: hashedStudentPassword,
        role: 'STUDENT',
        department: studentSeedDepartment,
        group: 'ИС-21',
        admissionYear: studentSeedAdmissionYear,
        privacyConsentAt: consentAt,
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        termsConsentAt: consentAt,
        termsConsentVersion: TERMS_VERSION,
        consentSource: 'setup',
        profileCompletedAt: consentAt,
      }
    });

    const hashedAdminPassword = await bcrypt.hash(adminSeedPassword, 10);
    for (let index = 0; index < resolvedAdminEmails.length; index += 1) {
      const email = resolvedAdminEmails[index];
      const existingAdmin = await prisma.user.findUnique({ where: { email } });
      const name = adminSeedName
        ? (adminSeedName.includes('{n}')
          ? adminSeedName.replace('{n}', String(index + 1))
          : adminSeedName)
        : email.split('@')[0];

      await prisma.user.upsert({
        where: { email },
        update: {
          name: existingAdmin?.name || name,
          password: hashedAdminPassword,
          role: 'ADMIN',
          department: existingAdmin?.department || adminSeedDepartment,
          privacyConsentAt: existingAdmin?.privacyConsentAt || consentAt,
          privacyConsentVersion:
            existingAdmin?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
          termsConsentAt: existingAdmin?.termsConsentAt || consentAt,
          termsConsentVersion:
            existingAdmin?.termsConsentVersion || TERMS_VERSION,
          consentSource: existingAdmin?.consentSource || 'setup',
          profileCompletedAt: existingAdmin?.profileCompletedAt || consentAt,
        },
        create: {
          email,
          name,
          password: hashedAdminPassword,
          role: 'ADMIN',
          department: adminSeedDepartment,
          privacyConsentAt: consentAt,
          privacyConsentVersion: PRIVACY_POLICY_VERSION,
          termsConsentAt: consentAt,
          termsConsentVersion: TERMS_VERSION,
          consentSource: 'setup',
          profileCompletedAt: consentAt,
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "Тестовые пользователи созданы/проверены",
      users: {
        teacher: `${teacherSeedEmail} / ${teacherSeedPassword}`,
        student: `${studentSeedEmail} / student`,
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
