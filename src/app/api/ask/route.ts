import { NextResponse } from "next/server";
import { answerQuestion, streamAnswerQuestion } from "@/lib/assistant";
import { ASSISTANT_STATUS } from "@/lib/assistant-status";

const encoder = new TextEncoder();

function encodeServerSentEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      context?: unknown;
      question?: unknown;
    };
    const question = typeof body.question === "string" ? body.question : "";
    const context = typeof body.context === "string" ? body.context : "";
    const acceptsStream = request.headers
      .get("accept")
      ?.includes("text/event-stream");

    if (acceptsStream) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await streamAnswerQuestion(
              question,
              (delta) => {
                controller.enqueue(encodeServerSentEvent("delta", { delta }));
              },
              { context },
            );

            controller.enqueue(encodeServerSentEvent("final", response));
          } catch (error) {
            console.error(error);
            controller.enqueue(
              encodeServerSentEvent("final", {
                status: ASSISTANT_STATUS.needsMoreContext,
                answer:
                  "Something went wrong while answering. Please try again or contact Cubby for support.",
                citations: [],
              }),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8",
        },
      });
    }

    const response = await answerQuestion(question, { context });

    return NextResponse.json(response);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        status: ASSISTANT_STATUS.needsMoreContext,
        answer:
          "Something went wrong while answering. Please try again or contact Cubby for support.",
        citations: [],
      },
      { status: 500 },
    );
  }
}
