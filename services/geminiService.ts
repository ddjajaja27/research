import { Paper, AnalysisResult, TrendAnalysisResult, AnalysisConfig } from '../types';

// Cache remains on client to avoid redundant network requests
const translationCache: Record<string, string> = {};

export const translateText = async (text: string): Promise<string> => {
  const cleanText = text.trim();
  if (!cleanText || cleanText.length < 2) return "";
  
  const cacheKey = cleanText.length > 50 ? cleanText.substring(0, 50) + cleanText.length : cleanText;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText })
    });
    
    if (!res.ok) throw new Error('Translation failed');
    
    const data = await res.json();
    translationCache[cacheKey] = data.translation;
    return data.translation;
  } catch (e) {
    console.error("Translation error", e);
    return "";
  }
};

export const analyzePapersWithGemini = async (
  papers: Paper[], 
  queryContext: string, 
  config: AnalysisConfig
): Promise<AnalysisResult> => {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ papers, context: queryContext, config })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Analysis failed');
  }

  return await res.json();
};

export const analyzeTrendsWithGemini = async (field: string, data: string): Promise<TrendAnalysisResult> => {
  const res = await fetch('/api/trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, data })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Trend analysis failed');
  }

  return await res.json();
};