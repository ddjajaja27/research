import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  BarChart2, 
  Moon, 
  Sun, 
  BookOpen, 
  Download, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Filter,
  Trash2,
  Plus,
  List,
  Globe,
  FileText,
  Zap,
  TrendingUp,
  Activity,
  Feather,
  Upload,
  Settings,
  Brain,
  Printer,
  FileJson,
  FileType,
  FileCode,
  Microscope,
  Database,
  Briefcase,
  Layers,
  Clock,
  RotateCcw,
  Layout,
  Table,
  Eye,
  Archive,
  File as FileIcon,
  CheckSquare,
  Square,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { AppMode, Paper, SearchQueryPart, SearchFilters, AnalysisResult, TrendAnalysisResult, AnalysisConfig, TopicCluster, EmergingTopic, SearchHistoryItem, AnalysisHistoryItem } from './types';
import { searchPubMed, fetchPaperDetails } from './services/pubmedService';
import { analyzePapersWithGemini, analyzeTrendsWithGemini } from './services/geminiService';
import { BubbleChart } from './components/BubbleChart';
import { RadarChartComponent } from './components/RadarChart';
import { WordCloud } from './components/WordCloud';
import { HoverableText } from './components/HoverableText';
import { GlobalSelectionTranslator } from './components/GlobalSelectionTranslator';
import { TopicDetailModal } from './components/TopicDetailModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer, Legend as LineLegend } from 'recharts';

const ARTICLE_TYPES = [
  'Journal Article', 
  'Review', 
  'Clinical Trial', 
  'Meta-Analysis', 
  'Randomized Controlled Trial'
];

export default function App() {
  // --- State ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mode, setMode] = useState<AppMode>(AppMode.SEARCH);
  
  // Search State
  const [searchMethod, setSearchMethod] = useState<'builder' | 'import' | 'manual' | 'upload'>('builder');
  const [importInput, setImportInput] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [coreTerm, setCoreTerm] = useState('');
  const [coreField, setCoreField] = useState('[Title/Abstract]');
  const [queryParts, setQueryParts] = useState<SearchQueryPart[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    yearStart: 2018,
    yearEnd: 2025,
    articleTypes: ['Review']
  });
  
  // Data State
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [papers, setPapers] = useState<Paper[]>([]);
  // New: Selection State
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  
  // For Import Mode, we store all IDs. For Search mode, we fetch on demand.
  const [importedIds, setImportedIds] = useState<string[]>([]);
  
  const [executedQuery, setExecutedQuery] = useState(''); 
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>({
    creativity: 0.5,
    depth: 0.5,
    focus: 'balanced',
    algorithm: 'consultant', 
    maxPapers: 50
  });
  const [processingStep, setProcessingStep] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // New: Data fetching state for analysis
  const [isFetchingAnalysisData, setIsFetchingAnalysisData] = useState(false);
  
  // Modal State
  const [selectedTopic, setSelectedTopic] = useState<TopicCluster | EmergingTopic | null>(null);

  // Trend Analysis State
  const [trendField, setTrendField] = useState('');
  const [trendInput, setTrendInput] = useState('');
  const [isTrendAnalyzing, setIsTrendAnalyzing] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendAnalysisResult | null>(null);

  // History State
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);

  // Printing/Exporting State
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // UI State
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Refs
  const resultsRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load history on mount
  useEffect(() => {
    const savedSearch = localStorage.getItem('searchHistory');
    const savedAnalysis = localStorage.getItem('analysisHistory');
    if (savedSearch) setSearchHistory(JSON.parse(savedSearch));
    if (savedAnalysis) setAnalysisHistory(JSON.parse(savedAnalysis));
  }, []);

  // Save history on change
  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
  }, [analysisHistory]);

  // Process Visualization Effect
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProcessingStep(0);
      const steps = 4; // Total visual steps
      interval = setInterval(() => {
        setProcessingStep(prev => (prev < steps - 1 ? prev + 1 : prev));
      }, 1500); // Change step every 1.5s
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // --- Handlers ---
  
  const addToSearchHistory = (query: string, count: number, resultPapers: Paper[]) => {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      query,
      count,
      papers: resultPapers.slice(0, 50) 
    };
    setSearchHistory(prev => [newItem, ...prev].slice(0, 20)); 
  };

  const addToAnalysisHistory = (result: AnalysisResult) => {
    const newItem: AnalysisHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      config: analysisConfig,
      result
    };
    setAnalysisHistory(prev => [newItem, ...prev].slice(0, 10)); 
  };

  const addQueryPart = () => {
    const newPart: SearchQueryPart = {
      id: Date.now().toString(),
      operator: 'AND',
      term: '',
      field: '[Title/Abstract]'
    };
    setQueryParts([...queryParts, newPart]);
  };

  const removeQueryPart = (id: string) => {
    setQueryParts(queryParts.filter(p => p.id !== id));
  };

  const updateQueryPart = (id: string, field: keyof SearchQueryPart, value: string) => {
    setQueryParts(queryParts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const togglePaperSelection = (id: string) => {
      const newSet = new Set(selectedPaperIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedPaperIds(newSet);
  };

  const toggleSelectAll = () => {
      // If all displayed papers are selected, deselect them. Otherwise, select all displayed.
      const displayedIds = displayPapers.map(p => p.id);
      const allSelected = displayedIds.every(id => selectedPaperIds.has(id));
      
      const newSet = new Set(selectedPaperIds);
      if (allSelected) {
          displayedIds.forEach(id => newSet.delete(id));
      } else {
          displayedIds.forEach(id => newSet.add(id));
      }
      setSelectedPaperIds(newSet);
  };

  const buildQueryString = () => {
    if (!coreTerm) return '';
    let q = `(${coreTerm}${coreField})`;
    queryParts.forEach(part => {
      if (part.term) {
        q += ` ${part.operator} (${part.term}${part.field})`;
      }
    });
    q += ` AND (${filters.yearStart}:${filters.yearEnd}[dp])`;
    if (filters.articleTypes.length > 0) {
       const types = filters.articleTypes.map(t => `${t}[pt]`).join(' OR ');
       q += ` AND (${types})`;
    }
    return q;
  };

  const handleSearch = async () => {
    if (searchMethod === 'builder' && !coreTerm) return;
    if (searchMethod === 'import' && !importInput.trim()) return;
    if (searchMethod === 'manual' && !manualInput.trim()) return;
    if (searchMethod === 'upload' && !fileToUpload) return;

    setIsSearching(true);
    setMode(AppMode.SEARCH);
    setAnalysisResult(null); 
    setPapers([]);
    setSelectedPaperIds(new Set()); // Clear selection on new search
    setCurrentPage(1);
    setTotalCount(0);
    setExecutedQuery('');
    
    try {
      if (searchMethod === 'builder') {
          const q = buildQueryString();
          setExecutedQuery(q);
          setImportedIds([]); 
          const { ids, count } = await searchPubMed(q, 0, pageSize);
          setTotalCount(count);
          if (ids.length > 0) {
            const details = await fetchPaperDetails(ids);
            setPapers(details);
            setSelectedPaperIds(new Set(details.map(p => p.id))); // Auto-select loaded results
            addToSearchHistory(q, count, details);
          }
      } else if (searchMethod === 'import') {
          const ids = importInput.match(/\d+/g) || [];
          if (ids.length === 0) {
              alert("No valid PubMed IDs found in the input.");
              setIsSearching(false);
              return;
          }
          setImportedIds(ids);
          setTotalCount(ids.length);
          setExecutedQuery(`Import: ${ids.length} IDs`); 
          const firstPageIds = ids.slice(0, pageSize);
          const details = await fetchPaperDetails(firstPageIds);
          setPapers(details);
          setSelectedPaperIds(new Set(details.map(p => p.id)));
          addToSearchHistory(`Imported ${ids.length} IDs`, ids.length, details);
      } else if (searchMethod === 'manual') {
          const rawEntries = manualInput.split(/\n\s*\n/); 
          const manualPapers: Paper[] = rawEntries.map((entry, idx) => {
              const lines = entry.trim().split('\n');
              const title = lines[0] || "Untitled";
              const abstract = lines.slice(1).join(' ') || "No abstract provided.";
              return {
                  id: `manual-${Date.now()}-${idx}`,
                  title: title,
                  abstract: abstract,
                  year: new Date().getFullYear(),
                  journal: 'Manual Import',
                  authors: ['Local Import']
              };
          }).filter(p => p.title.length > 0);
          setTotalCount(manualPapers.length);
          setPapers(manualPapers);
          setSelectedPaperIds(new Set(manualPapers.map(p => p.id))); 
          setImportedIds([]); 
          addToSearchHistory('Manual Input', manualPapers.length, manualPapers);
      } else if (searchMethod === 'upload') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            if (!content) return;
            let parsedPapers: Paper[] = [];
            try {
              if (fileToUpload?.name.toLowerCase().endsWith('.json')) {
                  const data = JSON.parse(content);
                  if (Array.isArray(data)) parsedPapers = data;
              }
              if (parsedPapers.length > 0) {
                  setPapers(parsedPapers);
                  setTotalCount(parsedPapers.length);
                  setExecutedQuery(`File: ${fileToUpload.name}`);
                  setSelectedPaperIds(new Set(parsedPapers.map(p => p.id)));
                  addToSearchHistory(`File: ${fileToUpload.name}`, parsedPapers.length, parsedPapers);
              }
              setIsSearching(false);
            } catch (err) {
              console.error(err);
              setIsSearching(false);
            }
          };
          reader.readAsText(fileToUpload!);
          return; 
      }
    } catch (e) {
      console.error(e);
      alert('Search failed. See console.');
    } finally {
        if (searchMethod !== 'upload') setIsSearching(false);
    }
  };

  const loadPage = async (page: number) => {
    if (searchMethod === 'manual' || searchMethod === 'upload') {
        setCurrentPage(page);
        return; 
    }
    setIsSearching(true);
    try {
      const start = (page - 1) * pageSize;
      let pageIds: string[] = [];
      if (searchMethod === 'builder') {
         const { ids } = await searchPubMed(executedQuery, start, pageSize);
         pageIds = ids;
      } else if (searchMethod === 'import') {
         const end = start + pageSize;
         pageIds = importedIds.slice(start, end);
      }
      const details = await fetchPaperDetails(pageIds);
      setPapers(details);
      // When loading a new page, by default select them for convenience
      setSelectedPaperIds(new Set(details.map(p => p.id)));
      setCurrentPage(page);
    } catch(e) {
      console.error(e);
      alert("Failed to load page");
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchForAnalysis = async () => {
      // Explicitly fetch data for review based on config
      if (papers.length >= analysisConfig.maxPapers) return;

      setIsFetchingAnalysisData(true);
      try {
          let newPapers: Paper[] = [];
          // If we have imported IDs, use them
          if (searchMethod === 'import' && importedIds.length > 0) {
               const needed = importedIds.slice(0, analysisConfig.maxPapers);
               // Filter out what we already have
               const existingIds = new Set(papers.map(p => p.id));
               const missingIds = needed.filter(id => !existingIds.has(id));
               
               if (missingIds.length > 0) {
                  const fetched = await fetchPaperDetails(missingIds);
                  newPapers = [...papers, ...fetched];
               }
          } 
          // If builder mode
          else if (searchMethod === 'builder' && executedQuery) {
              // Fetch up to maxPapers
              const { ids } = await searchPubMed(executedQuery, 0, analysisConfig.maxPapers);
              const fetched = await fetchPaperDetails(ids);
              newPapers = fetched;
          }

          if (newPapers.length > 0) {
              setPapers(newPapers);
              // Auto select the new ones
              const newSet = new Set(selectedPaperIds);
              newPapers.forEach(p => newSet.add(p.id));
              setSelectedPaperIds(newSet);
          }
      } catch (e) {
          console.error(e);
          alert("Error fetching data for review.");
      } finally {
          setIsFetchingAnalysisData(false);
      }
  };

  const handleAnalyze = async () => {
    // Filter papers based on Selection
    const candidatePapers = papers.filter(p => selectedPaperIds.has(p.id));
    
    if (candidatePapers.length === 0) {
        alert("No papers selected for analysis. Please review your dataset selection.");
        return;
    }

    setIsAnalyzing(true);
    setMode(AppMode.ANALYSIS);
    try {
      const context = searchMethod === 'builder' ? coreTerm : "Selected Research Papers";
      // We pass the filtered list. 
      // Important: We disable the 'maxPapers' slicing inside the service if we are explicit, 
      // but the service logic currently slices. 
      // To respect the user's explicit selection, we set maxPapers to the length of candidates in the config passed.
      const explicitConfig = { ...analysisConfig, maxPapers: candidatePapers.length };
      
      const res = await analyzePapersWithGemini(candidatePapers, context, explicitConfig);
      setAnalysisResult(res);
      addToAnalysisHistory(res);
    } catch (e: any) {
      console.error(e);
      let errorMsg = e.message || "Unknown error";
      alert(`Analysis Failed:\n${errorMsg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTrendAnalysis = async () => {
      if (!trendInput.trim() || !trendField.trim()) {
          alert("Please enter both the Research Field and the Data.");
          return;
      }
      setIsTrendAnalyzing(true);
      try {
          const res = await analyzeTrendsWithGemini(trendField, trendInput);
          setTrendResult(res);
      } catch (e: any) {
          console.error(e);
          const errorMsg = e.message || "Unknown error";
          alert(`Trend analysis failed. Error: ${errorMsg}`);
      } finally {
          setIsTrendAnalyzing(false);
      }
  };

  const openPubMedSearch = () => {
      if (!executedQuery) return;
      const url = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(executedQuery)}`;
      window.open(url, '_blank');
  };

  // --- EXPORT HANDLERS ---

  const handleExportPDF = async () => {
    if (!resultsRef.current || !analysisResult) return;
    
    // 1. Setup UI for Capture
    const originalTheme = theme;
    setShowExportMenu(false);
    setIsExportingPdf(true);
    setIsPrinting(true); // Disable animations for capture
    
    // Force light mode for PDF clarity
    if (theme === 'dark') setTheme('light'); 
    
    // Wait for render cycle
    await new Promise(resolve => setTimeout(resolve, 500));

    const element = resultsRef.current;
    
    // 2. html2pdf Options
    const opt = {
      margin:       [10, 10], // top, left, bottom, right (mm)
      filename:     `research_insight_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 3. Generate
    try {
      // @ts-ignore
      if (window.html2pdf) {
         // @ts-ignore
         await window.html2pdf().set(opt).from(element).save();
      } else {
         alert("PDF library not loaded. Please wait or refresh.");
      }
    } catch (e) {
      console.error("PDF Export failed", e);
      alert("PDF Generation failed. Try the Print option instead.");
    } finally {
      // 4. Cleanup
      if (originalTheme === 'dark') setTheme('dark');
      setIsExportingPdf(false);
      setIsPrinting(false);
    }
  };

  const handleExportHTML = () => {
    if (!resultsRef.current || !analysisResult) return;
    const clone = resultsRef.current.cloneNode(true) as HTMLElement;
    const elementsToRemove = clone.querySelectorAll('button, input, select, .no-export');
    elementsToRemove.forEach(el => el.remove());

    const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Report</title><script src="https://cdn.tailwindcss.com"></script></head><body class="p-8"><div class="max-w-5xl mx-auto">${clone.innerHTML}</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `research_report_${Date.now()}.html`;
    link.click();
    setShowExportMenu(false);
  };

  const handleExport = (format: 'markdown' | 'json' | 'csv' | 'html' | 'pdf') => {
      if (!analysisResult) return;
      
      if (format === 'pdf') { handleExportPDF(); return; }
      if (format === 'html') { handleExportHTML(); return; }
      
      let content = '', mimeType = 'text/plain', extension = 'txt';
      if (format === 'json') {
          content = JSON.stringify(analysisResult, null, 2);
          mimeType = 'application/json'; extension = 'json';
      } else if (format === 'markdown') {
          content = `# Research Analysis\n${analysisResult.summary}`;
          mimeType = 'text/markdown'; extension = 'md';
      } else if (format === 'csv') {
          content = "Topic,Impact,Volume\n" + analysisResult.topics.map(t => `${t.name},${t.impact},${t.volume}`).join('\n');
          mimeType = 'text/csv'; extension = 'csv';
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_${Date.now()}.${extension}`;
      link.click();
      setShowExportMenu(false);
  };

  const displayPapers = (searchMethod === 'manual' || searchMethod === 'upload')
    ? papers.slice((currentPage - 1) * pageSize, currentPage * pageSize) 
    : papers;

  // --- RENDERERS ---
  const renderVisionaryResults = (result: AnalysisResult) => (
    <div className="space-y-8 animate-in fade-in duration-700">
        <div className={`bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden ${isExportingPdf ? 'print:break-inside-avoid' : ''}`}>
             <div className="absolute top-0 right-0 opacity-10"><Brain size={400} /></div>
             <div className="relative z-10">
                 <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Future Horizon</h2>
                 <p className="text-xl text-indigo-100 font-light leading-relaxed max-w-4xl border-l-4 border-yellow-400 pl-6">{result.summary}</p>
                 <div className="mt-6 flex gap-4 text-sm font-mono text-indigo-300">
                     <span>Analyzed: {result.totalPapersAnalyzed || 0} papers</span><span>|</span><span>Perspective: Visionary</span>
                 </div>
             </div>
        </div>
        {result.emergingTopics.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {result.emergingTopics.map((topic, i) => (
                     <div key={i} onClick={() => setSelectedTopic(topic)} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl hover:-translate-y-1 transition-transform cursor-pointer border-t-8 border-t-yellow-400 break-inside-avoid">
                         <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-bold text-gray-900 dark:text-white">{topic.name}</h3><Zap className="text-yellow-500" /></div>
                         <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{topic.reason}</p>
                         <div className="flex justify-between items-center text-sm font-bold text-gray-400"><span>POTENTIAL</span><span className="text-yellow-600 dark:text-yellow-400">{(topic.potentialScore * 10).toFixed(1)}/10</span></div>
                     </div>
                 ))}
             </div>
        )}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 break-inside-avoid">
             <h3 className="text-xl font-bold mb-6 flex items-center dark:text-white"><Layout className="mr-2"/> Knowledge Landscape</h3>
             <WordCloud topics={result.topics} onTopicClick={setSelectedTopic} />
        </div>
    </div>
  );

  const renderStrictResults = (result: AnalysisResult) => (
      <div className="space-y-6 animate-in fade-in duration-300 font-mono text-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 text-white p-4 rounded shadow"><div className="text-xs text-gray-400 uppercase">Input Volume</div><div className="text-2xl font-bold">{result.totalPapersAnalyzed || 0}</div></div>
              <div className="bg-gray-900 text-white p-4 rounded shadow"><div className="text-xs text-gray-400 uppercase">Noise Rejected</div><div className="text-2xl font-bold text-red-400">{result.noiseCount || 0}</div></div>
              <div className="bg-gray-900 text-white p-4 rounded shadow"><div className="text-xs text-gray-400 uppercase">Clusters Formed</div><div className="text-2xl font-bold text-green-400">{result.topics.length}</div></div>
              <div className="bg-gray-900 text-white p-4 rounded shadow"><div className="text-xs text-gray-400 uppercase">Density Score</div><div className="text-2xl font-bold text-blue-400">High</div></div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2 dark:text-white border-b pb-2">CLUSTERING_REPORT.LOG</h3>
              <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 mb-4">{result.summary}</p>
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
                              <th className="p-2">ID</th><th className="p-2">TOPIC_LABEL</th><th className="p-2">KEYWORDS</th><th className="p-2">DENSITY</th><th className="p-2">NOVELTY</th><th className="p-2">STATUS</th>
                          </tr>
                      </thead>
                      <tbody>
                          {result.topics.map(t => (
                              <tr key={t.id} onClick={() => setSelectedTopic(t)} className="border-b border-gray-200 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer">
                                  <td className="p-2 text-gray-500">{t.id.substring(0,6)}</td><td className="p-2 font-bold text-blue-700 dark:text-blue-400">{t.name}</td><td className="p-2 text-xs">{t.keywords.slice(0,4).join(', ')}</td><td className="p-2">{t.volume}</td><td className="p-2">{t.novelty.toFixed(2)}</td><td className="p-2"><span className={`px-1 rounded ${t.trend === 'rising' ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-800'}`}>{t.trend.toUpperCase()}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  const renderStandardResults = (result: AnalysisResult) => (
      <div className="space-y-6 animate-in fade-in">
           <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded-r-lg shadow-sm">
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Analysis Summary</h2>
               <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{result.summary}</p>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BubbleChart topics={result.topics} onTopicClick={setSelectedTopic} isPrinting={isPrinting} />
                <RadarChartComponent topics={result.topics} isPrinting={isPrinting} />
           </div>
           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Topic Trends</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} /><YAxis /><LineTooltip /><LineLegend />{Array.from(new Set(result.trendData.map(d => d.topic))).map((topic, i) => (<Line key={topic} type="monotone" dataKey="count" data={result.trendData.filter(d => d.topic === topic)} name={topic} stroke={['#FF4B4B', '#2ECC71', '#F1C40F', '#3498DB'][i%4]} />))}</LineChart>
                    </ResponsiveContainer>
                </div>
           </div>
      </div>
  );

  const renderLoadingState = () => {
    // Mode A Skeleton
    if (analysisConfig.algorithm === 'consultant') { 
        return (
            <div className="space-y-8 animate-in fade-in">
                 <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-3xl animate-pulse flex items-center justify-center">
                    <div className="text-center">
                        <Brain className="text-gray-300 dark:text-gray-700 h-24 w-24 mx-auto mb-4 animate-bounce" />
                        <p className="text-gray-400 dark:text-gray-600 font-medium">Consulting Future Scenarios...</p>
                        <p className="text-xs text-gray-400 mt-2">Processing {selectedPaperIds.size} inputs</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"></div>)}
                 </div>
            </div>
        )
    }
    
    // Mode C Skeleton
    if (analysisConfig.algorithm === 'strict') { 
        return (
            <div className="space-y-6 font-mono">
                 <div className="grid grid-cols-4 gap-4">
                     {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-900 rounded animate-pulse"></div>)}
                 </div>
                 <div className="h-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded animate-pulse p-4 flex flex-col justify-center items-center">
                     <Microscope className="h-16 w-16 text-gray-200 dark:text-gray-800 mb-4 animate-spin-slow" />
                     <p className="text-gray-500 font-mono">CALCULATING_DENSITY_CLUSTERS...</p>
                 </div>
            </div>
        )
    }

    // Mode B (Standard) Skeleton - Using the Charts with isLoading=true
    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="h-32 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 rounded-r-lg animate-pulse p-6">
                <div className="h-4 bg-blue-200 dark:bg-blue-800/30 w-1/3 mb-4 rounded"></div>
                <div className="h-3 bg-blue-100 dark:bg-blue-800/20 w-3/4 rounded"></div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <BubbleChart topics={[]} isLoading={true} />
                 <RadarChartComponent topics={[]} isLoading={true} />
             </div>
             <div className="h-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"></div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <GlobalSelectionTranslator />
      
      {/* Export Overlay Loader */}
      {isExportingPdf && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm">
             <div className="text-center">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600 mx-auto mb-4"></div>
                 <h3 className="text-xl font-bold text-gray-800">Generating PDF...</h3>
                 <p className="text-gray-500 text-sm mt-1">Rendering charts and high-resolution layout.</p>
             </div>
          </div>
      )}

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 print:hidden flex flex-col">
        {/* ... Sidebar Content ... */}
        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <div className="flex items-center mb-8 pl-2">
            <span className="text-2xl mr-2">🧭</span>
            <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Research Compass v28</span>
          </div>
          <ul className="space-y-2 font-medium">
            <li><button onClick={() => setMode(AppMode.SEARCH)} className={`flex items-center p-2 w-full rounded-lg ${mode === AppMode.SEARCH ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Search className="w-5 h-5" /><span className="ml-3">Search & Build</span></button></li>
            <li><button onClick={() => setMode(AppMode.ANALYSIS)} disabled={!analysisResult && papers.length === 0} className={`flex items-center p-2 w-full rounded-lg ${mode === AppMode.ANALYSIS ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'} ${(!analysisResult && papers.length === 0) ? 'opacity-50' : ''}`}><BarChart2 className="w-5 h-5" /><span className="ml-3">AI Insight</span></button></li>
            <li><button onClick={() => setMode(AppMode.TREND_ANALYSIS)} className={`flex items-center p-2 w-full rounded-lg ${mode === AppMode.TREND_ANALYSIS ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}><TrendingUp className="w-5 h-5" /><span className="ml-3">Trend Analysis</span></button></li>
            <li><button onClick={() => setMode(AppMode.HISTORY)} className={`flex items-center p-2 w-full rounded-lg ${mode === AppMode.HISTORY ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Archive className="w-5 h-5" /><span className="ml-3">History</span></button></li>
          </ul>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
             <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-full flex items-center justify-center py-2 px-4 rounded bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors">
                  {theme === 'light' ? <Moon size={16} className="mr-2"/> : <Sun size={16} className="mr-2 text-yellow-300"/>}
                  <span className="text-sm dark:text-gray-200">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
             </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="p-4 sm:ml-64 print:ml-0 print:p-0">
        <div className="p-4 mt-2 print:mt-0 print:p-0">
          
          {/* SEARCH MODE */}
          {mode === AppMode.SEARCH && (
            <div className="space-y-6 print:hidden">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                {/* ... (Search Config) ... */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><Filter className="mr-2"/> Search Configuration</h2>
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-x-auto">
                        <button onClick={() => setSearchMethod('builder')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${searchMethod === 'builder' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Search size={16} className="mr-2"/> Keyword Search</button>
                        <button onClick={() => setSearchMethod('import')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${searchMethod === 'import' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><List size={16} className="mr-2"/> PMID Import</button>
                        <button onClick={() => setSearchMethod('manual')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${searchMethod === 'manual' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><FileText size={16} className="mr-2"/> Manual Input</button>
                        <button onClick={() => setSearchMethod('upload')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${searchMethod === 'upload' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Upload size={16} className="mr-2"/> File Upload</button>
                    </div>
                </div>
                
                {searchMethod === 'builder' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-3">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Core Term</label>
                            <input type="text" value={coreTerm} onChange={(e) => setCoreTerm(e.target.value)} placeholder="e.g., Lung Cancer" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Field</label>
                            <select value={coreField} onChange={(e) => setCoreField(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="[Title/Abstract]">[Title/Abstract]</option>
                            <option value="[Title]">[Title]</option>
                            <option value="[All Fields]">[All Fields]</option>
                            </select>
                        </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Start Year</label>
                            <input type="number" value={filters.yearStart} onChange={(e) => setFilters({...filters, yearStart: parseInt(e.target.value) || 1900})} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">End Year</label>
                            <input type="number" value={filters.yearEnd} onChange={(e) => setFilters({...filters, yearEnd: parseInt(e.target.value) || new Date().getFullYear()})} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div className="md:col-span-2 relative">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Article Types</label>
                            <button type="button" onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full p-2.5 text-left dark:bg-gray-700 dark:border-gray-600 dark:text-white flex justify-between items-center">
                                <span className="truncate mr-2">{filters.articleTypes.length > 0 ? filters.articleTypes.join(', ') : 'All Types'}</span>
                                <ChevronDown size={16} className="flex-shrink-0" />
                            </button>
                            {isTypeDropdownOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {ARTICLE_TYPES.map(type => (
                                        <div key={type} className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" onClick={() => { const newTypes = filters.articleTypes.includes(type) ? filters.articleTypes.filter(t => t !== type) : [...filters.articleTypes, type]; setFilters({...filters, articleTypes: newTypes}); }}>
                                            <input type="checkbox" checked={filters.articleTypes.includes(type)} readOnly className="w-4 h-4 pointer-events-none" />
                                            <label className="ml-2 text-sm text-gray-900 dark:text-gray-300 pointer-events-none">{type}</label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>
                        {queryParts.map((part, index) => (
                        <div key={part.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end">
                            <div className="md:col-span-2"><select value={part.operator} onChange={(e) => updateQueryPart(part.id, 'operator', e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white"><option>AND</option><option>OR</option><option>NOT</option></select></div>
                            <div className="md:col-span-7"><input type="text" value={part.term} onChange={(e) => updateQueryPart(part.id, 'term', e.target.value)} placeholder={`Keyword ${index + 1}`} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white" /></div>
                            <div className="md:col-span-2"><select value={part.field} onChange={(e) => updateQueryPart(part.id, 'field', e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white"><option value="[Title/Abstract]">[Title/Abstract]</option><option value="[Title]">[Title]</option></select></div>
                            <div className="md:col-span-1"><button onClick={() => removeQueryPart(part.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={20} /></button></div>
                        </div>
                        ))}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"><button onClick={addQueryPart} className="flex items-center text-primary-600 font-medium"><Plus size={18} className="mr-1"/> Add Keyword</button></div>
                    </div>
                )}
                {/* ... (Import/Manual/Upload inputs) ... */}
                {searchMethod === 'import' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Paste PubMed IDs (PMIDs)</label>
                        <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)} rows={5} placeholder="Paste PMIDs..." className="block p-2.5 w-full text-sm bg-gray-50 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></textarea>
                    </div>
                )}
                {searchMethod === 'manual' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Paste Papers</label>
                        <textarea value={manualInput} onChange={(e) => setManualInput(e.target.value)} rows={8} placeholder="Title\nAbstract..." className="block p-2.5 w-full text-sm bg-gray-50 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"></textarea>
                    </div>
                )}
                {searchMethod === 'upload' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Upload File</label>
                        <input type="file" accept=".json,.csv" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="block w-full text-sm border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 p-2" />
                    </div>
                )}
                <div className="flex justify-end items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={handleSearch} disabled={isSearching} className="text-white bg-primary-600 hover:bg-primary-700 font-medium rounded-lg text-sm px-5 py-2.5 flex items-center">
                        {isSearching ? 'Processing...' : 'Search & Load'}
                    </button>
                </div>
              </div>

              {/* Results */}
              {(papers.length > 0 || totalCount > 0) && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                   <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Results <span className="text-sm font-normal text-gray-500 ml-2">({totalCount} found)</span></h3>
                        <div className="flex items-center bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-md border border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase mr-2">Selection:</span>
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{selectedPaperIds.size}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       {/* Select All Toggle */}
                       <button onClick={toggleSelectAll} className="flex items-center px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-transparent mr-2">
                           <CheckSquare size={16} className="mr-1"/> Toggle Page
                       </button>
                       {searchMethod !== 'manual' && searchMethod !== 'upload' && (
                         <button onClick={openPubMedSearch} className="flex items-center px-3 py-1 text-sm text-blue-600 bg-blue-50 rounded border border-blue-200"><Globe size={16} className="mr-1"/> Open in PubMed</button>
                       )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {papers.length === 0 && isSearching ? (
                        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
                    ) : (
                        displayPapers.map((paper, idx) => (
                        <div key={paper.id} className={`p-4 border rounded-lg transition-colors flex gap-4 ${selectedPaperIds.has(paper.id) ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'}`}>
                            <div className="pt-1">
                                <input 
                                    type="checkbox" 
                                    checked={selectedPaperIds.has(paper.id)} 
                                    onChange={() => togglePaperSelection(paper.id)}
                                    className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                <h4 className="text-md font-semibold text-primary-600 dark:text-primary-400 mb-1 w-full"><span className="mr-2 text-gray-500 font-normal text-sm">{idx + 1 + (currentPage-1)*pageSize}.</span><HoverableText text={paper.title} className="inline" /></h4>
                                </div>
                                <p className="text-sm text-gray-500 mb-2">{paper.year} | {paper.journal} | {paper.authors ? paper.authors.join(", ") : 'Unknown'}</p>
                                <div className="text-sm text-gray-700 dark:text-gray-300"><HoverableText text={paper.abstract} /></div>
                            </div>
                        </div>
                        ))
                    )}
                  </div>
                  <div className="flex justify-center items-center mt-6 space-x-4">
                    <button onClick={() => loadPage(currentPage - 1)} disabled={currentPage === 1 || isSearching} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"><ChevronLeft /></button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Page {currentPage} of {Math.ceil(totalCount / pageSize)}</span>
                    <button onClick={() => loadPage(currentPage + 1)} disabled={currentPage >= Math.ceil(totalCount / pageSize) || isSearching} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"><ChevronRight /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANALYSIS MODE */}
          {mode === AppMode.ANALYSIS && (
            <div className="space-y-6">
              {!isAnalyzing && !analysisResult && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4">
                      {/* ... (Analysis Config) ... */}
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mb-6"><Settings className="mr-2" /> Analysis Configuration</h2>
                      <div className="space-y-8 max-w-4xl">
                          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                             <label className="block mb-3 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">1. Select Analysis Engine</label>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div onClick={() => setAnalysisConfig({...analysisConfig, algorithm: 'consultant'})} className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${analysisConfig.algorithm === 'consultant' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent bg-white dark:bg-gray-800'}`}>
                                    <div className="flex items-center mb-2"><Brain size={20} className="mr-2 text-primary-600"/><span className="font-semibold dark:text-white">Mode A</span></div>
                                    <p className="text-xs text-gray-500">Visionary Insight. Magazine Style.</p>
                                </div>
                                <div onClick={() => setAnalysisConfig({...analysisConfig, algorithm: 'standard'})} className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${analysisConfig.algorithm === 'standard' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-white dark:bg-gray-800'}`}>
                                    <div className="flex items-center mb-2"><Briefcase size={20} className="mr-2 text-blue-600"/><span className="font-semibold dark:text-white">Mode B</span></div>
                                    <p className="text-xs text-gray-500">Standard Analysis. Classic Dash.</p>
                                </div>
                                <div onClick={() => setAnalysisConfig({...analysisConfig, algorithm: 'strict'})} className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${analysisConfig.algorithm === 'strict' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent bg-white dark:bg-gray-800'}`}>
                                    <div className="flex items-center mb-2"><Microscope size={20} className="mr-2 text-purple-600"/><span className="font-semibold dark:text-white">Mode C</span></div>
                                    <p className="text-xs text-gray-500">Strict Math. Data Console.</p>
                                </div>
                             </div>
                          </div>
                           <div className="animate-in fade-in">
                                  <div className="flex justify-between mb-2 items-center">
                                      <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                                         <Layers className="mr-2" size={16}/> 2. Data Quantity (Target)
                                      </label>
                                      <span className="text-sm font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-primary-600 dark:text-primary-400">
                                          {analysisConfig.maxPapers} papers
                                      </span>
                                  </div>
                                  <input 
                                      type="range" 
                                      min="50" max="2000" step="50" 
                                      value={analysisConfig.maxPapers}
                                      onChange={(e) => setAnalysisConfig({...analysisConfig, maxPapers: parseInt(e.target.value)})}
                                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                                  />
                                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                                      <span>50 (Deep)</span>
                                      <span>2000 (High Volume - Title Only)</span>
                                  </div>
                          </div>

                          {/* 3. Review Dataset Section */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden animate-in fade-in">
                              <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                  <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                                     <List className="mr-2" size={16}/> 3. Review Dataset ({selectedPaperIds.size} Selected)
                                  </label>
                                  {papers.length < analysisConfig.maxPapers && searchMethod === 'builder' && (
                                      <button 
                                        onClick={handleFetchForAnalysis}
                                        disabled={isFetchingAnalysisData}
                                        className="text-xs flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                                      >
                                          {isFetchingAnalysisData ? <RefreshCw className="animate-spin mr-1" size={12}/> : <Download className="mr-1" size={12}/>}
                                          Fetch Pending Data ({Math.max(0, analysisConfig.maxPapers - papers.length)})
                                      </button>
                                  )}
                              </div>
                              <div className="max-h-60 overflow-y-auto p-0">
                                  {papers.length === 0 ? (
                                      <div className="p-8 text-center text-gray-500 text-sm">No papers loaded. Please search or import data.</div>
                                  ) : (
                                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                          {papers.map(p => (
                                              <div key={p.id} className="flex items-start p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={selectedPaperIds.has(p.id)} 
                                                      onChange={() => togglePaperSelection(p.id)}
                                                      className="mt-1 mr-3 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                                                      <p className="text-xs text-gray-500 truncate">{p.year} • {p.journal}</p>
                                                  </div>
                                                  <button onClick={() => togglePaperSelection(p.id)} className="ml-2 text-gray-400 hover:text-red-500">
                                                      <XCircle size={14} />
                                                  </button>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                              {papers.length < analysisConfig.maxPapers && (
                                  <div className="p-2 bg-yellow-50 dark:bg-yellow-900/10 text-xs text-yellow-700 dark:text-yellow-400 text-center border-t border-yellow-100 dark:border-yellow-800/30">
                                      Tip: You requested {analysisConfig.maxPapers} papers but only {papers.length} are loaded. Click "Fetch Pending Data" to see them all.
                                  </div>
                              )}
                          </div>

                          <div className="pt-4">
                              <button onClick={handleAnalyze} disabled={selectedPaperIds.size === 0} className="w-full text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg text-lg px-5 py-3 transition-colors flex justify-center items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0">
                                  <Brain className="mr-2" /> Start Analysis ({selectedPaperIds.size} Papers)
                              </button>
                          </div>
                      </div>
                  </div>
              )}
              
              {isAnalyzing && renderLoadingState()}

              {!isAnalyzing && analysisResult && (
                <>
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 print:hidden relative">
                      <button onClick={() => setAnalysisResult(null)} className="text-gray-600 hover:text-gray-900 flex items-center text-sm"><ChevronLeft size={16} className="mr-1" /> New Analysis</button>
                      
                      <div className="relative">
                          <button 
                            onClick={() => setShowExportMenu(!showExportMenu)} 
                            className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                          >
                            <Download size={18} className="mr-2" /> Export
                          </button>
                          
                          {showExportMenu && (
                              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 animate-in fade-in zoom-in-95 duration-200">
                                  <div className="py-1">
                                      <button onClick={() => handleExport('pdf')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                          <FileText size={16} className="mr-2 text-red-500"/> PDF Document
                                      </button>
                                      <button onClick={() => handleExport('html')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                          <Globe size={16} className="mr-2 text-blue-500"/> HTML Report
                                      </button>
                                      <button onClick={() => handleExport('markdown')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                          <FileCode size={16} className="mr-2 text-gray-500"/> Markdown
                                      </button>
                                      <button onClick={() => handleExport('json')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                          <FileJson size={16} className="mr-2 text-yellow-500"/> JSON Data
                                      </button>
                                      <button onClick={() => handleExport('csv')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                          <Table size={16} className="mr-2 text-green-500"/> CSV Table
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  <div ref={resultsRef}>
                    {analysisConfig.algorithm === 'consultant' && renderVisionaryResults(analysisResult)}
                    {analysisConfig.algorithm === 'strict' && renderStrictResults(analysisResult)}
                    {analysisConfig.algorithm === 'standard' && renderStandardResults(analysisResult)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TREND ANALYSIS MODE */}
          {mode === AppMode.TREND_ANALYSIS && (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center"><TrendingUp className="mr-2" /> Trend Forecaster</h2>
                    {/* ... (Trend Inputs) ... */}
                    <div className="space-y-4">
                        <div><label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Research Field</label><input type="text" value={trendField} onChange={(e) => setTrendField(e.target.value)} placeholder="e.g. AI in Medicine" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Context Data</label><textarea value={trendInput} onChange={(e) => setTrendInput(e.target.value)} rows={6} placeholder="Paste text..." className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></textarea></div>
                        <button onClick={handleTrendAnalysis} disabled={isTrendAnalyzing} className="text-white bg-primary-600 hover:bg-primary-700 font-medium rounded-lg text-sm px-5 py-2.5 flex items-center">{isTrendAnalyzing ? 'Analyzing...' : 'Forecast Trend'}</button>
                    </div>
                </div>
                {trendResult && (
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4">Trend Judgment: {trendResult.trendJudgment}</h3>
                        <p className="whitespace-pre-wrap">{trendResult.deepDive}</p>
                     </div>
                )}
            </div>
          )}

          {/* HISTORY MODE */}
          {mode === AppMode.HISTORY && (
              <div className="space-y-6 animate-in fade-in">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center"><Clock className="mr-2"/> Research History</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold mb-4 flex items-center"><Search className="mr-2" size={16}/> Recent Searches</h3>
                          <div className="space-y-2">
                              {searchHistory.length === 0 && <p className="text-gray-500 text-sm">No search history yet.</p>}
                              {searchHistory.map(item => (
                                  <div key={item.id} onClick={() => { setPapers(item.papers); setTotalCount(item.count); setMode(AppMode.SEARCH); }} className="p-3 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer group">
                                      <div className="flex justify-between"><span className="font-medium text-primary-600 truncate max-w-[200px]">{item.query}</span><span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</span></div><div className="text-xs text-gray-500 mt-1">{item.count} papers found</div>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold mb-4 flex items-center"><Brain className="mr-2" size={16}/> Analysis Archives</h3>
                          <div className="space-y-2">
                              {analysisHistory.length === 0 && <p className="text-gray-500 text-sm">No analysis history yet.</p>}
                              {analysisHistory.map(item => (
                                  <div key={item.id} onClick={() => { setAnalysisResult(item.result); setAnalysisConfig(item.config); setMode(AppMode.ANALYSIS); }} className="p-3 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer group">
                                      <div className="flex justify-between items-start"><span className="font-medium text-purple-600">{item.result.topics.length} Topics Identified</span><span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</span></div>
                                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.result.summary}</div>
                                      <div className="mt-2 flex gap-2"><span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">{item.config.algorithm.toUpperCase()}</span><span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">{item.result.totalPapersAnalyzed} Papers</span></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end"><button onClick={() => { localStorage.removeItem('searchHistory'); localStorage.removeItem('analysisHistory'); setSearchHistory([]); setAnalysisHistory([]); }} className="text-red-500 text-sm hover:underline flex items-center"><Trash2 size={14} className="mr-1"/> Clear All History</button></div>
              </div>
          )}
        </div>
        
        {/* Topic Detail Modal */}
        {selectedTopic && (
            <TopicDetailModal 
                topic={selectedTopic} 
                allPapers={papers} 
                trendData={analysisResult?.trendData} 
                onClose={() => setSelectedTopic(null)} 
            />
        )}
      </div>
    </div>
  );
}