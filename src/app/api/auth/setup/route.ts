/**
 * File responsibility:
 * Explicitly gated local auth bootstrap endpoint for development setup tasks.
 *
 * Main logic:
 * - Return current demo-account status for local development
 * - Create/update demo accounts only when the endpoint is intentionally enabled
 *
 * Security notes:
 * - Disabled by default
 * - Never available in production
 * - Requires a setup token on every request
 * - Does not return raw passwords in responses
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

const devSetupToken = process.env.DEV_SETUP_TOKEN?.trim() || "";
const isSetupEndpointEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_SETUP_ENDPOINT === "true" &&
  Boolean(devSetupToken);

const notFoundResponse = () => NextResponse.json({ error: "Not found" }, { status: 404 });
const forbiddenResponse = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

const isAuthorizedSetupRequest = (req: NextRequest) => {
  const headerToken = req.headers.get("x-dev-setup-token")?.trim();
  const bearerToken = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  return Boolean(devSetupToken) && (headerToken === devSetupToken || bearerToken === devSetupToken);
};

const getResolvedAdminEmails = () => {
  const adminEmails = (process.env.ADMIN_SEED_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return adminEmails.length > 0 ? adminEmails : defaultAdminEmails;
};

const ensureSetupAccess = (req: NextRequest) => {
  if (!isSetupEndpointEnabled) return notFoundResponse();
  if (!isAuthorizedSetupRequest(req)) return forbiddenResponse();
  return null;
};

export async function GET(req: NextRequest) {
  const denied = ensureSetupAccess(req);
  if (denied) return denied;

  try {
    const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || "MainTeacher2026@bgitu.ru";
    const resolvedAdminEmails = getResolvedAdminEmails();

    const [teacher, student, admins] = await Promise.all([
      prisma.user.findUnique({
        where: { email: teacherSeedEmail },
        select: { email: true, role: true },
      }),
      prisma.user.findUnique({
        where: { email: studentSeedEmail },
        select: { email: true, role: true },
      }),
      prisma.user.findMany({
        where: { email: { in: resolvedAdminEmails } },
        select: { email: true, role: true },
        orderBy: { email: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      users: {
        teacher: teacher
          ? { exists: true, email: teacher.email, role: teacher.role }
          : { exists: false, email: teacherSeedEmail, role: null },
        student: student
          ? { exists: true, email: student.email, role: student.role }
          : { exists: false, email: studentSeedEmail, role: null },
        admins: {
          count: admins.length,
          emails: admins.map((admin) => admin.email),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function POST(req: NextRequest) {
  const denied = ensureSetupAccess(req);
  if (denied) return denied;

  try {
    const teacherSeedEmail = process.env.TEACHER_SEED_EMAIL || "MainTeacher2026@bgitu.ru";
    const teacherSeedPassword = process.env.TEACHER_SEED_PASSWORD || "T9mW2pK7sL8xQ4cN";
    const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD || "R5mQ9tX2sL7pV8cN";
    const adminSeedName = process.env.ADMIN_SEED_NAME;
    const resolvedAdminEmails = getResolvedAdminEmails();

    const hashedTeacherPassword = await bcrypt.hash(teacherSeedPassword, 10);
    const hashedStudentPassword = await bcrypt.hash("student", 10);
    const hashedAdminPassword = await bcrypt.hash(adminSeedPassword, 10);
    const consentAt = new Date();

    const [existingTeacher, existingStudent] = await Promise.all([
      prisma.user.findUnique({
        where: { email: teacherSeedEmail },
      }),
      prisma.user.findUnique({
        where: { email: studentSeedEmail },
      }),
    ]);

    await prisma.user.upsert({
      where: { email: teacherSeedEmail },
      update: {
        name: existingTeacher?.name || "Main Teacher",
        password: hashedTeacherPassword,
        role: "TEACHER",
        department: existingTeacher?.department || teacherSeedDepartment,
        privacyConsentAt: existingTeacher?.privacyConsentAt || consentAt,
        privacyConsentVersion:
          existingTeacher?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
        termsConsentAt: existingTeacher?.termsConsentAt || consentAt,
        termsConsentVersion:
          existingTeacher?.termsConsentVersion || TERMS_VERSION,
        consentSource: existingTeacher?.consentSource || "setup",
        profileCompletedAt: existingTeacher?.profileCompletedAt || consentAt,
      },
      create: {
        email: teacherSeedEmail,
        name: "Main Teacher",
        password: hashedTeacherPassword,
        role: "TEACHER",
        department: teacherSeedDepartment,
        privacyConsentAt: consentAt,
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        termsConsentAt: consentAt,
        termsConsentVersion: TERMS_VERSION,
        consentSource: "setup",
        profileCompletedAt: consentAt,
      },
    });

    await prisma.user.upsert({
      where: { email: studentSeedEmail },
      update: {
        name: existingStudent?.name || "Мария Сидорова",
        password: hashedStudentPassword,
        role: "STUDENT",
        department: existingStudent?.department || studentSeedDepartment,
        group: existingStudent?.group || "ИС-21",
        admissionYear: existingStudent?.admissionYear || studentSeedAdmissionYear,
        privacyConsentAt: existingStudent?.privacyConsentAt || consentAt,
        privacyConsentVersion:
          existingStudent?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
        termsConsentAt: existingStudent?.termsConsentAt || consentAt,
        termsConsentVersion:
          existingStudent?.termsConsentVersion || TERMS_VERSION,
        consentSource: existingStudent?.consentSource || "setup",
        profileCompletedAt: existingStudent?.profileCompletedAt || consentAt,
      },
      create: {
        email: studentSeedEmail,
        name: "Мария Сидорова",
        password: hashedStudentPassword,
        role: "STUDENT",
        department: studentSeedDepartment,
        group: "ИС-21",
        admissionYear: studentSeedAdmissionYear,
        privacyConsentAt: consentAt,
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        termsConsentAt: consentAt,
        termsConsentVersion: TERMS_VERSION,
        consentSource: "setup",
        profileCompletedAt: consentAt,
      },
    });

    for (let index = 0; index < resolvedAdminEmails.length; index += 1) {
      const email = resolvedAdminEmails[index];
      const existingAdmin = await prisma.user.findUnique({ where: { email } });
      const name = adminSeedName
        ? (adminSeedName.includes("{n}")
          ? adminSeedName.replace("{n}", String(index + 1))
          : adminSeedName)
        : email.split("@")[0];

      await prisma.user.upsert({
        where: { email },
        update: {
          name: existingAdmin?.name || name,
          password: hashedAdminPassword,
          role: "ADMIN",
          department: existingAdmin?.department || adminSeedDepartment,
          privacyConsentAt: existingAdmin?.privacyConsentAt || consentAt,
          privacyConsentVersion:
            existingAdmin?.privacyConsentVersion || PRIVACY_POLICY_VERSION,
          termsConsentAt: existingAdmin?.termsConsentAt || consentAt,
          termsConsentVersion:
            existingAdmin?.termsConsentVersion || TERMS_VERSION,
          consentSource: existingAdmin?.consentSource || "setup",
          profileCompletedAt: existingAdmin?.profileCompletedAt || consentAt,
        },
        create: {
          email,
          name,
          password: hashedAdminPassword,
          role: "ADMIN",
          department: adminSeedDepartment,
          privacyConsentAt: consentAt,
          privacyConsentVersion: PRIVACY_POLICY_VERSION,
          termsConsentAt: consentAt,
          termsConsentVersion: TERMS_VERSION,
          consentSource: "setup",
          profileCompletedAt: consentAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Тестовые пользователи созданы или обновлены",
      users: {
        teacher: teacherSeedEmail,
        student: studentSeedEmail,
        admins: resolvedAdminEmails,
      },
      note: "Пароли не возвращаются API. Используйте значения из переменных окружения.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
