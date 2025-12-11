import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server API Key configuration missing" }, { status: 500 });
    }

    const { papers, context, config } = await req.json();
    
    // Server-side initialization of Gemini
    const ai = new GoogleGenAI({ apiKey });

    const papersText = papers.map((p: any) => 
      `ID: ${p.id} | Year: ${p.year} | Title: ${p.title} | Journal: ${p.journal}`
    ).join('\n');

    let focusInstruction = "";
    if (config.focus === 'broad') focusInstruction = "Focus on high-level themes and cross-disciplinary connections.";
    if (config.focus === 'specific') focusInstruction = "Focus on specific methodologies, molecular mechanisms, and granular details.";

    const prompt = `
    # Role & Objective
    You are a **Senior Chief Scientist** and **Strategic Intelligence Analyst**... [Keep strictly strictly aligned with your prompt engineering]
    ...
    # ANALYSIS ALGORITHM (Mimic BERTopic Pipeline):
    Step 1 [Embed & Cluster]: Mentally group these ${papers.length} papers into distinct semantic clusters based on their underlying mechanisms, not just surface keywords.
    Step 2 [Extract]: For each cluster, extract 5-8 keywords that maximize the "semantic distance" from other clusters.
    Step 3 [Label]: Generate a "Topic Label" that synthesizes the mechanism + the application.

    # Critical Constraints & Logic
    1. **NO Textbook Categories**: Do NOT group results into broad, generic categories.
    2. **Discriminative Keywords ONLY**: Pick words that are **unique to this topic**.
    3. **Temporal Weighting**: 
       - 'RISING': Majority papers 2024-2025.
       - 'STABLE': Spread 2020-2025.
       - 'DECLINING': Older.
    4. **Source Attribution**: Map Paper IDs explicitly.
    5. **Configuration**: Speculation: ${(config.creativity * 100).toFixed(0)}%, Granularity: ${(config.depth * 100).toFixed(0)}%. ${focusInstruction}

    # Output Structure (Strict JSON)
    Return a valid JSON object matching the requested schema.

    # Input Data
    ${papersText}
  `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: config.creativity,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            methodology: { type: Type.STRING },
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  novelty: { type: Type.NUMBER },
                  impact: { type: Type.NUMBER },
                  volume: { type: Type.NUMBER },
                  trend: { type: Type.STRING, enum: ["rising", "stable", "declining"] },
                  description: { type: Type.STRING },
                  paperIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            emergingTopics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  potentialScore: { type: Type.NUMBER },
                  paperIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            trendData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.NUMBER },
                  topic: { type: Type.STRING },
                  count: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    if (!response.text) throw new Error("AI returned empty response");
    
    return NextResponse.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}