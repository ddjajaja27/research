import { GoogleGenAI, Type } from "@google/genai";
import { Paper, AnalysisResult, TrendAnalysisResult, AnalysisConfig, TopicCluster } from '../types';

// Cache for translations to minimize API calls
const translationCache: Record<string, string> = {};

// Helper for retries with exponential backoff
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errorMessage = err.message || JSON.stringify(err);
    
    // CRITICAL FIX: Do not retry if Quota Exceeded (429)
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
      throw new Error("⚠️ API Quota Exceeded. The system is momentarily rate-limited by Google. Please wait a minute or analyze fewer papers.");
    }
    
    // Catch RPC/Network errors specifically (Error Code 6 / XHR failed)
    if (errorMessage.includes("Rpc failed") || errorMessage.includes("error code: 6") || errorMessage.includes("XHR")) {
      throw new Error("⚠️ Network Payload Too Large. Please reduce 'Max Papers' to < 100, or the request size exceeded browser limits.");
    }

    if (retries <= 0) throw err;
    
    console.warn(`API Call failed, retrying in ${delay}ms... Attempts left: ${retries}.`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
}

export const translateText = async (text: string): Promise<string> => {
  const cleanText = text.trim(); 
  
  if (!cleanText || cleanText.length < 2) return "";
  
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
          contents: `Translate to Simplified Chinese:\n"${cleanText}"`,
      });
      const translation = response.text?.trim() || "";
      translationCache[cacheKey] = translation;
      return translation;
    } catch (e) {
      console.warn("Translation skipped due to error");
      return "";
    }
  }, 1, 1000); 
};

export const analyzePapersWithGemini = async (
  papers: Paper[], 
  queryContext: string, 
  config: AnalysisConfig = { creativity: 0.5, depth: 0.5, focus: 'balanced', algorithm: 'consultant', maxPapers: 50 }
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  // 1. LIMIT DATASET SIZE
  // Even if config says 2000, we check if the actual payload is getting too dangerous for XHR
  const MAX_PAPERS = config.maxPapers || 50; 
  const papersToAnalyze = papers.slice(0, MAX_PAPERS);
  
  // If analyzing > 100 papers, force "Titles Only" to save bandwidth unless specifically strictly small
  const isHighVolume = papersToAnalyze.length > 100;

  // 2. CONSTRUCT PROMPT WITH STRICT LIMITS
  let papersText = papersToAnalyze.map(p => {
    if (isHighVolume) {
       // Minimal format for high volume
       return `ID:${p.id}|Y:${p.year}|${p.title}`;
    } else {
       // Full format for deep analysis
       const abstract = p.abstract ? p.abstract.substring(0, 500) : 'NA'; // Truncate individual abstracts
       return `ID:${p.id}|Y:${p.year}|${p.title}|${abstract}`;
    }
  }).join('\n');

  // 3. SAFETY TRUNCATION (CRITICAL FIX FOR ERROR CODE 6)
  // Browser XHR requests fail if body > ~1MB depending on proxy. 
  // We limit to ~300,000 characters to be safe.
  const MAX_SAFE_CHARS = 300000;
  if (papersText.length > MAX_SAFE_CHARS) {
      console.warn(`Payload too large (${papersText.length} chars). Truncating to safe limit.`);
      papersText = papersText.substring(0, MAX_SAFE_CHARS) + "\n...[TRUNCATED_TO_PREVENT_CRASH]";
  }

  // --- MODE C: STRICT MATH SIMULATOR ---
  if (config.algorithm === 'strict') {
      const prompt = `
ROLE: STRICT DATA CLUSTERING ENGINE.
DATASET_SIZE: ${papersToAnalyze.length} papers.
MODE: ${isHighVolume ? "HIGH_VOLUME (Titles Only)" : "DEEP_SCAN (Abstracts)"}

PROTOCOL:
1. FILTER NOISE: Identify generic papers (20-40%).
2. CLUSTER: Group remaining papers by specific mechanism/target.
3. OUTPUT: JSON.

INPUT DATA:
${papersText}
`;

    return callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        noise_paper_count: { type: Type.NUMBER },
                        topics: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    paperIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    trend: { type: Type.STRING, enum: ["rising", "stable", "declining"] },
                                    impact: { type: Type.NUMBER },
                                    novelty: { type: Type.NUMBER },
                                    description: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!response.text) throw new Error("No response from AI");
        const rawData = JSON.parse(response.text);

        const topics: TopicCluster[] = rawData.topics.map((t: any) => ({
             id: t.id || Math.random().toString(36).substr(2, 9),
             name: t.name,
             keywords: t.keywords || [],
             novelty: t.novelty ?? 0.5,
             impact: t.impact ?? 0.5,
             volume: t.paperIds ? t.paperIds.length : 0,
             trend: t.trend || 'stable',
             description: t.description || "Cluster identified via strict density analysis.",
             paperIds: t.paperIds || []
        }));

        // Calculate trends locally to save AI output tokens
        const trendData: { year: number; topic: string; count: number }[] = [];
        topics.forEach(t => {
            const yearCounts: Record<number, number> = {};
            t.paperIds.forEach(pid => {
                const p = papers.find(paper => paper.id === pid);
                if (p) {
                    yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
                }
            });
            Object.entries(yearCounts).forEach(([year, count]) => {
                trendData.push({ year: parseInt(year), topic: t.name, count });
            });
        });

        const emergingTopics = topics
            .filter(t => t.trend === 'rising' || t.novelty > 0.8)
            .map(t => ({
                name: t.name,
                reason: `High Density Cluster (Strict Mode).`,
                potentialScore: t.novelty,
                paperIds: t.paperIds
            }));

        return {
            topics,
            emergingTopics,
            trendData,
            summary: rawData.summary || "Strict analysis completed.",
            methodology: isHighVolume ? "Mode C (High Vol): Strict Title Clustering" : "Mode C: Strict Abstract Clustering",
            noiseCount: rawData.noise_paper_count,
            stopwords: [],
            totalPapersAnalyzed: papersToAnalyze.length,
            timestamp: new Date().toISOString(),
            modeUsed: 'Strict (Mode C)'
        };
    });
  }

  // --- MODE A / B ---
  
  let temp = 0.5;
  let modeName = "Standard";
  let systemInstr = "";

  if (config.algorithm === 'standard') {
      modeName = "Standard (Mode B)";
      temp = 0.3;
      systemInstr = "Role: Research Assistant. Task: Group papers by factual topics. Style: Descriptive, comprehensive.";
  } else {
      modeName = "Consultant (Mode A)";
      temp = 0.85;
      systemInstr = "Role: Visionary Scientist. Task: Find hidden connections/future trends. Style: Provocative.";
  }

  const prompt = `
${systemInstr}
Dataset: ${papersToAnalyze.length} papers.
${isHighVolume ? "Note: Analyzing Titles Only (High Volume)." : ""}

Task: Analyze and Cluster.

Input:
${papersText}
  `;

  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: temp,
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

    if (!response.text) {
      throw new Error("No response text received from AI");
    }

    const result = JSON.parse(response.text) as AnalysisResult;
    result.totalPapersAnalyzed = papersToAnalyze.length;
    result.timestamp = new Date().toISOString();
    result.modeUsed = modeName;
    return result;
  });
};

export const analyzeTrendsWithGemini = async (field: string, inputData: string): Promise<TrendAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  // Truncate input data to safe limit to avoid 431/500 errors
  const safeInput = inputData.substring(0, 20000);

  const prompt = `
    Role: Strategic Analyst.
    Task: Forecast trends for field: "${field}".
    Data: ${safeInput}
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
            trendJudgment: { type: Type.STRING },
            deepDive: { type: Type.STRING },
            abstractSection: { type: Type.STRING }
          }
        }
      }
    });

    if (!response.text) throw new Error("No response");

    return JSON.parse(response.text) as TrendAnalysisResult;
  });
};