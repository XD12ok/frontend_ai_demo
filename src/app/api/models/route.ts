const AI_API_BASE = process.env.AI_API_BASE;
const AI_API_KEY = process.env.AI_API_KEY;

export async function GET() {
  if (!AI_API_BASE) {
    return Response.json(
      { error: "AI_API_BASE belum diset di .env.local" },
      { status: 500 }
    );
  }

  try {
    const upstream = await fetch(`${AI_API_BASE}/api/model`, {
      headers: {
        ...(AI_API_KEY ? { "X-API-Key": AI_API_KEY } : {}),
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `AI error (${upstream.status})` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return Response.json({
      default_model: data.default_model,
      models: Array.isArray(data.models) ? data.models : [],
    });
  } catch {
    return Response.json(
      { error: "Tidak bisa menghubungi server AI" },
      { status: 502 }
    );
  }
}
