import { talkToAI } from "@/actions/ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { input, currentPage, lastResponse }: {
    input: string;
    currentPage: string;
    lastResponse: string;
  } = await req.json();
  const result = await talkToAI(input, currentPage, lastResponse);

  console.log(result);
  
  return NextResponse.json(result);
}