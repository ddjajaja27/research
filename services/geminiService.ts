import { GoogleGenAI, Type } from "@google/genai";
import { Paper, AnalysisResult, TrendAnalysisResult, AnalysisConfig } from '../types';

// Cache for translations to minimize API calls
const translationCache: Record<string, string> = {};

// Helper for retries with exponential backoff
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries <= 0) throw err;
    console.warn(`API Call failed, retrying... Attempts left: ${retries}. Error:`, err);
    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
}

export const translateText = async (text: string): Promise<string> => {
  const cleanText = text.trim(); 
  
  if (!cleanText || cleanText.length < 2) return "";
  
  // Create a cache key using the first 50 chars + length to avoid huge keys but maintain uniqueness
  const cacheKey = cleanText.length > 50 ? cleanText.substring(0, 50) + cleanText.length : cleanText;

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  if (!process.env.API_KEY) return "Key Missing";

  return callWithRetry(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Translate the following text to Simplified Chinese.
Context: Scientific research paper abstract.
Text: "${cleanText}"
Instructions:
- Return ONLY the translation.
- Maintain professional scientific tone.
- Do not include explanations.`,
      });
      const translation = response.text?.trim() || "";
      translationCache[cacheKey] = translation;
      return translation;
    } catch (e) {
      console.error("Translation error", e);
      return ""; // Return empty on fail to not break UI
    }
  }, 2, 500); // Fewer retries for translation to keep UI snappy
};

export const analyzePapersWithGemini = async (
  papers: Paper[], 
  queryContext: string, 
  config: AnalysisConfig = { creativity: 0.5, depth: 0.5, focus: 'balanced' }
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  // CRITICAL FIX for "Rpc failed / XHR error":
  // Browsers have limits on request size. Sending 100+ abstracts often crashes the request.
  // We limit to 50 high-quality inputs to ensure stability.
  const MAX_PAPERS = 50;
  const papersToAnalyze = papers.slice(0, MAX_PAPERS);
  
  const papersText = papersToAnalyze.map(p => 
    `ID: ${p.id} | Year: ${p.year} | Title: ${p.title} | Journal: ${p.journal}`
  ).join('\n');

  // Adjust prompt based on configuration
  let focusInstruction = "";
  if (config.focus === 'broad') focusInstruction = "Focus on high-level themes and cross-disciplinary connections.";
  if (config.focus === 'specific') focusInstruction = "Focus on specific methodologies, molecular mechanisms, and granular details.";

  const prompt = `
    # Role & Objective
    You are a **Senior Chief Scientist** and **Strategic Intelligence Analyst** at a top-tier research institution (e.g., NIH, Nature Research). 
    Your task is to analyze the provided dataset of academic literature (Titles/Abstracts/Keywords/Years) related to "${queryContext}".
    
    # ANALYSIS ALGORITHM (Mimic BERTopic Pipeline):
    Step 1 [Embed & Cluster]: Mentally group these ${papers.length} papers into distinct semantic clusters based on their underlying mechanisms, not just surface keywords.
    Step 2 [Extract]: For each cluster, extract 5-8 keywords that maximize the "semantic distance" from other clusters (i.e., make them as distinct as possible).
    Step 3 [Label]: Generate a "Topic Label" that synthesizes the mechanism + the application (e.g., "Nanoparticle Delivery for KRAS-mutant Targeting").

    # Critical Constraints & Logic
    1. **NO Textbook Categories**: Do NOT group results into broad, generic categories like "Diagnosis", "Treatment". I need specific, actionable scientific fronts.
    2. **Discriminative Keywords ONLY (c-TF-IDF Simulation)**: When selecting 'Core Keywords' for a topic, do NOT just pick the most frequent words. Pick words that are **unique to this topic** compared to the others. 
       - Example: If 'Cancer' appears in all topics, do NOT list it as a keyword for any specific topic.
    3. **Temporal Weighting (Dynamic Evolution)**: Pay attention to the publication years.
       - 'RISING': Majority of key papers are from 2024-2025.
       - 'STABLE': Papers spread evenly 2020-2025.
       - 'DECLINING': Most papers are older.
       - Do not hallucinate trends; use the provided years.
    4. **Source Attribution**: You MUST explicitly map the provided Paper IDs to the generated topics.
    5. **Configuration**: Speculation Level: ${(config.creativity * 100).toFixed(0)}%, Granularity: ${(config.depth * 100).toFixed(0)}%. ${focusInstruction}

    # Output Structure (Strict JSON)
    Return a valid JSON object matching the requested schema.

    # Input Data
    ${papersText}
  `;

  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: config.creativity,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Executive summary for PIs needing investment intelligence." },
            methodology: { type: Type.STRING, description: "Explanation of the analysis logic and clustering strategy used (Max 150 words)." },
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: "Specific, insight-driven title (No generic nouns)." },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 5-8 most discriminatory specific terms (Proteins, Chemicals, Methods)." },
                  novelty: { type: Type.NUMBER, description: "0-1 score. How new/emerging is this?" },
                  impact: { type: Type.NUMBER, description: "0-1 score. Potential to change paradigms." },
                  volume: { type: Type.NUMBER, description: "Relative volume of papers." },
                  trend: { type: Type.STRING, enum: ["rising", "stable", "declining"] },
                  description: { type: Type.STRING, description: "One-Sentence Insight: What is the core scientific problem or breakthrough?" },
                  paperIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of exact Paper IDs from the input that belong to this cluster." }
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
                  paperIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of exact Paper IDs from the input that support this emerging trend." }
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

    if (!response.text) {
      throw new Error("No response text received from AI");
    }

    return JSON.parse(response.text) as AnalysisResult;
  });
};

export const analyzeTrendsWithGemini = async (field: string, data: string): Promise<TrendAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  // Truncate input data to prevent token overflow/timeout if user pastes massive text
  const safeData = data.length > 25000 ? data.substring(0, 25000) + "...[TRUNCATED]" : data;

  const prompt = `
    You are a Senior Medical Journal Editor (e.g., NEJM, Lancet). 
    I am a researcher in the field of: "${field}".
    
    The user has provided data for the "Top Research Hotspots" (containing keywords, composite index, novelty, heat, etc.):
    Data:
    """
    ${safeData}
    """

    Please perform the following 3 tasks strictly:

    1. **Trend Judgment**: Based on "Novelty" and "Heat" in the data, categorize the hotspots. Point out which are "Emerging Frontiers" (high novelty, rising heat) and which are "Mature Classics" (high heat, lower novelty or established). Explain briefly.
    2. **Deep Dive**: Identify the #1 ranked hotspot (or the most significant one). Combining your vast medical knowledge base, explain WHY it is so hot right now. What specific clinical pain point or mechanism does it address?
    3. **Abstract Writing**: Write a professional academic abstract (approx 300 words) summarizing these results, suitable for the "Results" section of a high-impact review paper.

    Return the response in JSON format.
  `;

  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trendJudgment: { type: Type.STRING, description: "Analysis of emerging vs mature trends" },
            deepDive: { type: Type.STRING, description: "Deep explanation of the top hotspot" },
            abstractSection: { type: Type.STRING, description: "Academic abstract for results section" }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text received from AI");
    }

    return JSON.parse(response.text) as TrendAnalysisResult;
  });
};