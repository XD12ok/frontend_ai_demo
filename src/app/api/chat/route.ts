const AI_API_BASE = process.env.AI_API_BASE;
const AI_API_KEY = process.env.AI_API_KEY;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!AI_API_BASE) {
    return Response.json(
      { error: "AI_API_BASE belum diset di .env.local" },
      { status: 500 }
    );
  }

  let body: { messages?: IncomingMessage[]; model?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  if (!body?.messages?.length) {
    return Response.json({ error: "messages wajib diisi" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${AI_API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AI_API_KEY ? { "X-API-Key": AI_API_KEY } : {}),
      },
      body: JSON.stringify({
        messages: body.messages,
        ...(body.model ? { model: body.model } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Tidak bisa menghubungi server AI" },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    let message = `AI error (${upstream.status})`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.detail) message = String(parsed.detail);
    } catch {
      if (detail) message = `${message} ${detail.slice(0, 200)}`.trim();
    }
    return Response.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload) continue;

            let event: {
              message?: { content?: string };
              error?: string;
              done?: boolean;
            };
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            if (event.error) {
              controller.enqueue(encoder.encode(`\n[${event.error}]`));
              continue;
            }
            const token = event.message?.content;
            if (token) controller.enqueue(encoder.encode(token));
          }
        }
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
