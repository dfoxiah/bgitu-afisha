import { NextResponse } from "next/server"

export function POST() {
  return NextResponse.json(
    {
      error: "Публичная регистрация отключена. Используйте вход через VK, MAX или Яндекс.",
    },
    { status: 410 }
  )
}
