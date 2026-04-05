import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const maxDuration = 30;

export async function GET() {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    return NextResponse.json({ status: "NO_KEY", message: "GROQ_API_KEY is not set" });
  }

  try {
    const groq = new Groq({ apiKey: key });
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Reply with just the word: OK" }],
      max_tokens: 5,
    });
    const reply = res.choices[0].message.content;
    return NextResponse.json({
      status: "OK",
      groq_response: reply,
      key_prefix: key.slice(0, 8) + "...",
    });
  } catch (err) {
    return NextResponse.json({
      status: "ERROR",
      error: String(err),
      key_prefix: key.slice(0, 8) + "...",
    });
  }
}
