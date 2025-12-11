export interface Paper {
  id: string;
  title: string;
  abstract: string;
  year: number;
  journal: string;
  authors?: string[];
}

export interface SearchQueryPart {
  id: string;
  operator: 'AND' | 'OR' | 'NOT';
  term: string;
  field: string;
}

export interface SearchFilters {
  yearStart: number;
  yearEnd: number;
  articleTypes: string[];
}

export interface TopicCluster {
  id: string;
  name: string;
  keywords: string[];
  novelty: number; // 0-1 score representing how "new" the research feels
  impact: number;  // 0-1 score representing journal quality/citation potential
  volume: number;  // Number of papers in this topic
  trend: 'rising' | 'stable' | 'declining';
  description: string;
  paperIds: string[]; // IDs of papers belonging to this cluster
}

export interface EmergingTopic {
  name: string;
  reason: string;
  potentialScore: number; // 0-1
  paperIds: string[]; // IDs of papers driving this emerging trend
}

export interface AnalysisConfig {
  creativity: number; // 0.0 to 1.0 (Temperature)
  depth: number;      // 0.0 to 1.0 (Detail level)
  focus: 'broad' | 'balanced' | 'specific';
  algorithm: 'consultant' | 'standard' | 'strict'; // UPDATED: 3 Modes
  maxPapers: number;  // New: Controls how many papers are fed into the engine
}

export interface AnalysisResult {
  topics: TopicCluster[];
  emergingTopics: EmergingTopic[];
  trendData: { year: number; topic: string; count: number }[];
  summary: string;
  methodology: string; // The "Thinking Process" explanation returned by AI
  // Optional strict mode metadata
  noiseCount?: number;
  stopwords?: string[];
  totalPapersAnalyzed?: number;
  timestamp?: string; // For history
  modeUsed?: string; // For history
}

export interface TrendAnalysisResult {
  trendJudgment: string;
  deepDive: string;
  abstractSection: string;
}

export enum AppMode {
  SEARCH = 'SEARCH',
  ANALYSIS = 'ANALYSIS',
  TREND_ANALYSIS = 'TREND_ANALYSIS',
  HISTORY = 'HISTORY' // New Mode
}

// History Types
export interface SearchHistoryItem {
  id: string;
  timestamp: number;
  query: string;
  count: number;
  papers: Paper[]; // Storing small result sets or IDs might be better, but we store full for now for easy restore
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  config: AnalysisConfig;
  result: AnalysisResult;
}
