import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "File uploads are handled through the admin post editor." }, { status: 404 });
}
