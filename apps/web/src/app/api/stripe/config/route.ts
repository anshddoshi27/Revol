import { NextResponse } from "next/server";

import { stripePlaceholderConfig } from "@/config/stripe";

export function GET() {
  return NextResponse.json(stripePlaceholderConfig);
}

