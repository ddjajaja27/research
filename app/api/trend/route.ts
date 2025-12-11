import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const { field, data } = await req.json();
    
    // Truncate logic on server side
    const safeData = data.length > 25000 ? data.substring(0, 25000) + "...[TRUNCATED]" : data;

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
    You are a Senior Medical Journal Editor (e.g., NEJM, Lancet). 
    I am a researcher in the field of: "${field}".
    Data: """${safeData}"""
    
    Tasks:
    1. Trend Judgment (Frontiers vs Classics).
    2. Deep Dive (Top hotspot analysis).
    3. Abstract Writing (Results section).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                trendJudgment: { type: Type.STRING },
                deepDive: { type: Type.STRING },
                abstractSection: { type: Type.STRING }
            }
        }
      }
    });

    return NextResponse.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}