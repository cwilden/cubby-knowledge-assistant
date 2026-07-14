import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/assistant";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: unknown };
    const question = typeof body.question === "string" ? body.question : "";
    const response = await answerQuestion(question);

    return NextResponse.json(response);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        status: "needs_more_context",
        answer:
          "Something went wrong while answering. Please try again or contact Cubby for support.",
        citations: [],
      },
      { status: 500 },
    );
  }
}
