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
  FileCode
} from 'lucide-react';
import { AppMode, Paper, SearchQueryPart, SearchFilters, AnalysisResult, TrendAnalysisResult, AnalysisConfig, TopicCluster, EmergingTopic } from './types';
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
  
  // For Import Mode, we store all IDs. For Search mode, we fetch on demand.
  const [importedIds, setImportedIds] = useState<string[]>([]);
  
  const [executedQuery, setExecutedQuery] = useState(''); // Stores the actual query used for "Open in PubMed" and API pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>({
    creativity: 0.5,
    depth: 0.5,
    focus: 'balanced'
  });
  const [processingStep, setProcessingStep] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Modal State
  const [selectedTopic, setSelectedTopic] = useState<TopicCluster | EmergingTopic | null>(null);

  // Trend Analysis State
  const [trendField, setTrendField] = useState('');
  const [trendInput, setTrendInput] = useState('');
  const [isTrendAnalyzing, setIsTrendAnalyzing] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendAnalysisResult | null>(null);

  // Printing State
  const [isPrinting, setIsPrinting] = useState(false);

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

  const buildQueryString = () => {
    if (!coreTerm) return '';
    let q = `(${coreTerm}${coreField})`;
    queryParts.forEach(part => {
      if (part.term) {
        q += ` ${part.operator} (${part.term}${part.field})`;
      }
    });
    // Add date range
    q += ` AND (${filters.yearStart}:${filters.yearEnd}[dp])`;
    // Add article types (simplified)
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
    setAnalysisResult(null); // Reset analysis on new search
    setPapers([]);
    setCurrentPage(1);
    setTotalCount(0);
    setExecutedQuery('');
    
    try {
      if (searchMethod === 'builder') {
          const q = buildQueryString();
          setExecutedQuery(q);
          setImportedIds([]); // Clear imported IDs

          // Fetch first page to get count
          const { ids, count } = await searchPubMed(q, 0, pageSize);
          setTotalCount(count);
          
          if (ids.length > 0) {
            const details = await fetchPaperDetails(ids);
            setPapers(details);
          }
      } else if (searchMethod === 'import') {
          // Import Mode
          const ids = importInput.match(/\d+/g) || [];
          if (ids.length === 0) {
              alert("No valid PubMed IDs found in the input.");
              setIsSearching(false);
              return;
          }
          setImportedIds(ids);
          setTotalCount(ids.length);
          setExecutedQuery(ids.join(',')); // For open in PubMed link

          const firstPageIds = ids.slice(0, pageSize);
          const details = await fetchPaperDetails(firstPageIds);
          setPapers(details);
      } else if (searchMethod === 'manual') {
          // Manual Mode
          const rawEntries = manualInput.split(/\n\s*\n/); // Split by empty lines
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

          if (manualPapers.length === 0) {
              alert("Could not parse papers. Ensure titles and abstracts are separated by empty lines.");
              setIsSearching(false);
              return;
          }

          setTotalCount(manualPapers.length);
          setPapers(manualPapers); 
          setImportedIds([]); 
      } else if (searchMethod === 'upload') {
          // File Upload Mode
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            if (!content) return;
            let parsedPapers: Paper[] = [];

            try {
              if (fileToUpload?.name.toLowerCase().endsWith('.json')) {
                  const data = JSON.parse(content);
                  if (Array.isArray(data)) {
                      parsedPapers = data.map((item: any, idx: number) => ({
                          id: item.id || `file-${Date.now()}-${idx}`,
                          title: item.title || "Untitled",
                          abstract: item.abstract || "",
                          year: item.year ? parseInt(item.year) : new Date().getFullYear(),
                          journal: item.journal || "Uploaded File",
                          authors: item.authors || []
                      }));
                  }
              } else if (fileToUpload?.name.toLowerCase().endsWith('.csv')) {
                  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                  if (lines.length < 2) throw new Error("CSV too short");
                  
                  const headerLine = lines[0].toLowerCase();
                  const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                  
                  const titleIdx = headers.findIndex(h => h.includes('title'));
                  const abstractIdx = headers.findIndex(h => h.includes('abstract'));
                  const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('date'));
                  const journalIdx = headers.findIndex(h => h.includes('journal') || h.includes('source'));

                  if (titleIdx === -1) {
                      alert("CSV must have a 'Title' column.");
                      setIsSearching(false);
                      return;
                  }

                  // Simple CSV line parser handling quotes
                  const parseCSVLine = (str: string) => {
                      const arr = [];
                      let quote = false;
                      let col = '';
                      for (let c of str) {
                          if (c === '"') { quote = !quote; continue; }
                          if (c === ',' && !quote) { arr.push(col); col = ''; continue; }
                          col += c;
                      }
                      arr.push(col);
                      return arr;
                  };

                  for (let i = 1; i < lines.length; i++) {
                      const cols = parseCSVLine(lines[i]);
                      if (cols.length <= titleIdx) continue;
                      
                      parsedPapers.push({
                          id: `file-${Date.now()}-${i}`,
                          title: cols[titleIdx]?.trim() || "Untitled",
                          abstract: abstractIdx !== -1 ? cols[abstractIdx]?.trim().replace(/^"|"$/g, '') || "" : "",
                          year: yearIdx !== -1 ? (parseInt(cols[yearIdx]?.replace(/\D/g, '')) || new Date().getFullYear()) : new Date().getFullYear(),
                          journal: journalIdx !== -1 ? cols[journalIdx]?.trim() || "Uploaded File" : "Uploaded File",
                          authors: []
                      });
                  }
              }

              if (parsedPapers.length > 0) {
                  setPapers(parsedPapers);
                  setTotalCount(parsedPapers.length);
                  setExecutedQuery(`File: ${fileToUpload.name}`);
              } else {
                  alert("No papers parsed. Check file format.");
              }
              setIsSearching(false);

            } catch (err) {
              console.error(err);
              alert("Error parsing file.");
              setIsSearching(false);
            }
          };
          reader.readAsText(fileToUpload!);
          return; // Reader is async, let it handle state updates
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
         // Re-fetch search with offset
         const { ids } = await searchPubMed(executedQuery, start, pageSize);
         pageIds = ids;
      } else if (searchMethod === 'import') {
         // Import mode: slice from local state
         const end = start + pageSize;
         pageIds = importedIds.slice(start, end);
      }
      
      const details = await fetchPaperDetails(pageIds);
      setPapers(details);
      setCurrentPage(page);
    } catch(e) {
      console.error(e);
      alert("Failed to load page");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyze = async () => {
    if (papers.length === 0) return;
    setIsAnalyzing(true);
    setMode(AppMode.ANALYSIS);
    try {
      const context = searchMethod === 'builder' ? coreTerm : "Selected Research Papers";
      // Pass the config from state
      const res = await analyzePapersWithGemini(papers, context, analysisConfig);
      setAnalysisResult(res);
    } catch (e: any) {
      console.error(e);
      // More specific error alerting
      const errorMsg = e.message || "Unknown error";
      alert(`Analysis failed. Error: ${errorMsg}\n\nPlease check your API key or reduce input size.`);
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

  // Export Handlers
  const handleExportHTML = () => {
    if (!resultsRef.current || !analysisResult) return;

    // Clone to manipulate without affecting UI
    const clone = resultsRef.current.cloneNode(true) as HTMLElement;

    // Clean up clone: Remove buttons, inputs, select elements, and anything marked no-export
    const elementsToRemove = clone.querySelectorAll('button, input, select, .no-export');
    elementsToRemove.forEach(el => el.remove());

    // Construct the full HTML document
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Research Analysis Report - ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: { 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' }
            }
          }
        }
      }
    </script>
    <style>
        body { 
          background-color: #f9fafb; 
          color: #111827; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
        .recharts-wrapper { margin: 0 auto; }
        /* Ensure dark mode styles from app don't break the light-themed report */
        .dark { color: #111827; background-color: #ffffff; }
    </style>
</head>
<body class="p-8">
    <div class="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div class="mb-8 border-b pb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Research Analysis Report</h1>
            <p class="text-gray-500">Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="space-y-8">
            ${clone.innerHTML}
        </div>
        <div class="mt-12 text-center text-sm text-gray-400 border-t pt-6">
            Generated by Research Compass AI
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `research_report_${Date.now()}.html`;
    link.click();
    setShowExportMenu(false);
  };

  const handleExport = (format: 'markdown' | 'json' | 'csv' | 'html') => {
      if (!analysisResult) return;
      
      if (format === 'html') {
          handleExportHTML();
          return;
      }

      let content = '';
      let mimeType = 'text/plain';
      let extension = 'txt';

      if (format === 'json') {
          content = JSON.stringify(analysisResult, null, 2);
          mimeType = 'application/json';
          extension = 'json';
      } else if (format === 'markdown') {
          content = `# Research Analysis Report\n\n`;
          content += `> Generated by Research Compass AI on ${new Date().toLocaleString()}\n\n`;
          
          content += `## 1. Summary\n${analysisResult.summary}\n\n`;
          content += `## 2. Methodology\n${analysisResult.methodology}\n\n`;
          
          content += `## 3. Emerging Frontiers (Eartopics)\n`;
          if (analysisResult.emergingTopics.length === 0) {
              content += "_No emerging topics identified._\n\n";
          } else {
              analysisResult.emergingTopics.forEach(e => {
                  content += `### ${e.name}\n`;
                  content += `- **Reasoning**: ${e.reason}\n`;
                  content += `- **Potential Score**: ${(e.potentialScore * 10).toFixed(1)}/10\n\n`;
              });
          }

          content += `## 4. Key Research Topics\n`;
          analysisResult.topics.forEach(t => {
              content += `### ${t.name}\n`;
              content += `- **Description**: ${t.description}\n`;
              content += `- **Keywords**: ${t.keywords.join(', ')}\n`;
              content += `- **Impact**: ${t.impact.toFixed(2)}\n`;
              content += `- **Novelty**: ${t.novelty.toFixed(2)}\n`;
              content += `- **Trend Status**: ${t.trend.toUpperCase()}\n`;
              content += `- **Paper Volume**: ${t.volume}\n\n`;
          });
          
          content += `## 5. Topic Evolution Data\n`;
          content += `| Topic | Year | Paper Count |\n|---|---|---|\n`;
          const sortedTrends = [...analysisResult.trendData].sort((a,b) => a.topic.localeCompare(b.topic) || a.year - b.year);
          sortedTrends.forEach(d => {
              content += `| ${d.topic} | ${d.year} | ${d.count} |\n`;
          });

          mimeType = 'text/markdown';
          extension = 'md';
      } else if (format === 'csv') {
          // Enhanced CSV to include more data sections flatly
          content = "Section,Item Name,Details/Keywords,Metric 1 (Impact/Score),Metric 2 (Novelty),Metric 3 (Trend),Metric 4 (Volume),Description\n";
          
          // Add Summary Row
          content += `"Summary","Report Summary","See Description",,,,"${analysisResult.summary.replace(/"/g, '""')}"\n`;

          // Topics
          analysisResult.topics.forEach(t => {
              const safeName = t.name.replace(/"/g, '""');
              const safeDesc = t.description.replace(/"/g, '""');
              const safeKeywords = t.keywords.join('; ').replace(/"/g, '""');
              content += `"Topic Cluster","${safeName}","${safeKeywords}",${t.impact},${t.novelty},"${t.trend}",${t.volume},"${safeDesc}"\n`;
          });

          // Emerging Topics
          analysisResult.emergingTopics.forEach(e => {
             const safeName = e.name.replace(/"/g, '""');
             const safeReason = e.reason.replace(/"/g, '""');
             content += `"Emerging Topic","${safeName}","${safeReason}",${e.potentialScore},,,,\n`;
          });
          
          // Trend Data
          const sortedTrends = [...analysisResult.trendData].sort((a,b) => a.topic.localeCompare(b.topic) || a.year - b.year);
          sortedTrends.forEach(d => {
             const safeTopic = d.topic.replace(/"/g, '""');
             content += `"Trend Data","${safeTopic}","Year: ${d.year}","Count: ${d.count}",,,,\n`;
          });

          mimeType = 'text/csv';
          extension = 'csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analysis_export_${Date.now()}.${extension}`;
      link.click();
      setShowExportMenu(false);
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    
    // Save current theme
    const prevTheme = theme;
    
    // Switch to light mode and set printing state to disable animations
    // We do this to ensure the print output is clean (no dark backgrounds) and charts are static
    setTheme('light');
    setIsPrinting(true);

    // Set delay to 100ms: fast enough to feel responsive, slow enough for React to render light mode
    setTimeout(() => {
        try {
            window.print();
        } catch (e) {
            console.error("Print failed", e);
            alert("Could not open print dialog. Please try using your browser's menu to print.");
        } finally {
            // Reset state after print dialog closes (code execution resumes here)
            setIsPrinting(false);
            setTheme(prevTheme);
        }
    }, 100);
  };

  // Helper to slice manual/uploaded papers for display
  const displayPapers = (searchMethod === 'manual' || searchMethod === 'upload')
    ? papers.slice((currentPage - 1) * pageSize, currentPage * pageSize) 
    : papers;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <GlobalSelectionTranslator />
      {/* Enhanced Print Styles */}
      <style>{`
        @media print {
            @page { margin: 1cm; size: portrait; }
            body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                background: white !important;
                color: #111827 !important;
                font-size: 11pt;
            }
            
            /* UI Cleanup */
            aside, .no-print, button, input, select, .fixed { display: none !important; }
            
            /* Main Content Expansion */
            .p-4.sm\\:ml-64 { margin-left: 0 !important; padding: 0 !important; }
            .min-h-screen { min-height: auto !important; height: auto !important; }
            
            /* Card Restyling for Ink Saving & Readability */
            .bg-white, .dark\\:bg-gray-800 {
                box-shadow: none !important;
                border: 1px solid #e5e7eb !important;
                background-color: white !important;
                color: black !important;
                break-inside: avoid;
                margin-bottom: 1.5rem;
            }
            
            /* Typography Override */
            h1, h2, h3, h4 { 
                color: #000 !important; 
                break-after: avoid; 
            }
            p, li, td { color: #333 !important; }
            
            /* Summary Card Specifics: Invert heavy gradients to borders */
            .bg-gradient-to-r.from-primary-600 {
                background: white !important;
                border: 2px solid #0284c7 !important;
                color: #000 !important;
            }
            .bg-gradient-to-r.from-primary-600 h2,
            .bg-gradient-to-r.from-primary-600 p {
                color: #000 !important;
                opacity: 1 !important;
            }
            
            /* Emerging Topics Card */
            .bg-gradient-to-br {
                background: #f9fafb !important;
                border: 1px solid #e5e7eb !important;
            }

            /* Charts Layout */
            .grid-cols-1.lg\\:grid-cols-2 {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 1rem !important;
            }
            /* If screen is small, print might default to 1 col, force 2 col if space permits or stack */
            /* Actually stacking is safer for charts to avoid squishing */
            
            /* Recharts specific fixes */
            .recharts-wrapper { width: 100% !important; margin: 0 auto; }
            
            /* Hide scrollbars */
            ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 print:hidden">
        <div className="h-full px-3 py-4 overflow-y-auto">
          <div className="flex items-center mb-8 pl-2">
            <span className="text-2xl mr-2">🧭</span>
            <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Research Compass</span>
          </div>
          
          <ul className="space-y-2 font-medium">
            <li>
              <button 
                onClick={() => setMode(AppMode.SEARCH)}
                className={`flex items-center p-2 w-full rounded-lg group ${mode === AppMode.SEARCH ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Search className="w-5 h-5 transition duration-75" />
                <span className="ml-3">Search & Build</span>
              </button>
            </li>
            <li>
              <button 
                onClick={() => setMode(AppMode.ANALYSIS)}
                disabled={papers.length === 0 && !analysisResult} // Allow view if result exists
                className={`flex items-center p-2 w-full rounded-lg group ${mode === AppMode.ANALYSIS ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'} ${(papers.length === 0 && !analysisResult) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <BarChart2 className="w-5 h-5 transition duration-75" />
                <span className="ml-3">AI Insight</span>
              </button>
            </li>
             <li>
              <button 
                onClick={() => setMode(AppMode.TREND_ANALYSIS)}
                className={`flex items-center p-2 w-full rounded-lg group ${mode === AppMode.TREND_ANALYSIS ? 'bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <TrendingUp className="w-5 h-5 transition duration-75" />
                <span className="ml-3">Trend Analysis</span>
              </button>
            </li>
          </ul>

          <div className="absolute bottom-4 left-0 w-full px-4">
             <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Theme</p>
                <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="w-full flex items-center justify-center py-2 px-4 rounded bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                >
                  {theme === 'light' ? <Moon size={16} className="mr-2"/> : <Sun size={16} className="mr-2 text-yellow-300"/>}
                  <span className="text-sm dark:text-gray-200">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="p-4 sm:ml-64 print:ml-0 print:p-0">
        <div className="p-4 mt-2 print:mt-0 print:p-0">
          
          {/* SEARCH MODE */}
          {mode === AppMode.SEARCH && (
            <div className="space-y-6 print:hidden">
              
              {/* Query Builder / Import Area */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Filter className="mr-2"/> Search Configuration
                    </h2>
                    
                    {/* Method Toggle */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-x-auto">
                        <button 
                            onClick={() => setSearchMethod('builder')}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                searchMethod === 'builder' 
                                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <Search size={16} className="mr-2"/> Keyword Search
                        </button>
                        <button 
                            onClick={() => setSearchMethod('import')}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                searchMethod === 'import' 
                                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <List size={16} className="mr-2"/> PMID Import
                        </button>
                        <button 
                            onClick={() => setSearchMethod('manual')}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                searchMethod === 'manual' 
                                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <FileText size={16} className="mr-2"/> Manual Input
                        </button>
                        <button 
                            onClick={() => setSearchMethod('upload')}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                searchMethod === 'upload' 
                                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <Upload size={16} className="mr-2"/> File Upload
                        </button>
                    </div>
                </div>
                
                {/* Method 1: Query Builder */}
                {searchMethod === 'builder' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-3">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Core Term</label>
                            <input 
                            type="text" 
                            value={coreTerm}
                            onChange={(e) => setCoreTerm(e.target.value)}
                            placeholder="e.g., Lung Cancer"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Field</label>
                            <select 
                            value={coreField}
                            onChange={(e) => setCoreField(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                            <option value="[Title/Abstract]">[Title/Abstract]</option>
                            <option value="[Title]">[Title]</option>
                            <option value="[All Fields]">[All Fields]</option>
                            </select>
                        </div>
                        </div>

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Start Year</label>
                            <input 
                            type="number" 
                            value={filters.yearStart}
                            onChange={(e) => setFilters({...filters, yearStart: parseInt(e.target.value) || 1900})}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">End Year</label>
                            <input 
                            type="number" 
                            value={filters.yearEnd}
                            onChange={(e) => setFilters({...filters, yearEnd: parseInt(e.target.value) || new Date().getFullYear()})}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div className="md:col-span-2 relative">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Article Types</label>
                            <button
                                type="button"
                                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 w-full p-2.5 text-left dark:bg-gray-700 dark:border-gray-600 dark:text-white flex justify-between items-center"
                            >
                                <span className="truncate mr-2">
                                    {filters.articleTypes.length > 0 ? filters.articleTypes.join(', ') : 'All Types'}
                                </span>
                                <ChevronDown size={16} className="flex-shrink-0" />
                            </button>
                            
                            {isTypeDropdownOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-10" 
                                        onClick={() => setIsTypeDropdownOpen(false)}
                                    ></div>
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {ARTICLE_TYPES.map(type => (
                                            <div 
                                                key={type} 
                                                className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                                                onClick={() => {
                                                    const newTypes = filters.articleTypes.includes(type)
                                                        ? filters.articleTypes.filter(t => t !== type)
                                                        : [...filters.articleTypes, type];
                                                    setFilters({...filters, articleTypes: newTypes});
                                                }}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={filters.articleTypes.includes(type)}
                                                    readOnly
                                                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 pointer-events-none"
                                                />
                                                <label className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer pointer-events-none">
                                                    {type}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        </div>

                        {/* Dynamic Parts */}
                        {queryParts.map((part, index) => (
                        <div key={part.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end">
                            <div className="md:col-span-2">
                            <select 
                                value={part.operator}
                                onChange={(e) => updateQueryPart(part.id, 'operator', e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white"
                            >
                                <option>AND</option>
                                <option>OR</option>
                                <option>NOT</option>
                            </select>
                            </div>
                            <div className="md:col-span-7">
                            <input 
                                type="text" 
                                value={part.term}
                                onChange={(e) => updateQueryPart(part.id, 'term', e.target.value)}
                                placeholder={`Keyword ${index + 1}`}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white"
                            />
                            </div>
                            <div className="md:col-span-2">
                            <select 
                                value={part.field}
                                onChange={(e) => updateQueryPart(part.id, 'field', e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="[Title/Abstract]">[Title/Abstract]</option>
                                <option value="[Title]">[Title]</option>
                            </select>
                            </div>
                            <div className="md:col-span-1">
                            <button 
                                onClick={() => removeQueryPart(part.id)}
                                className="text-red-500 hover:text-red-700 p-2"
                            >
                                <Trash2 size={20} />
                            </button>
                            </div>
                        </div>
                        ))}

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                           <button 
                            onClick={addQueryPart}
                            className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 font-medium"
                           >
                             <Plus size={18} className="mr-1"/> Add Keyword
                           </button>
                        </div>
                    </div>
                )}

                {/* Method 2: Direct Import */}
                {searchMethod === 'import' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                            Paste PubMed IDs (PMIDs)
                        </label>
                        <textarea
                            value={importInput}
                            onChange={(e) => setImportInput(e.target.value)}
                            rows={5}
                            placeholder="Paste a list of PMIDs separated by commas, spaces, or newlines (e.g., 34567890, 23456789)..."
                            className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        ></textarea>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Perform your search on PubMed, export or copy the PMIDs, and paste them here to analyze them directly.
                        </p>
                    </div>
                )}

                {/* Method 3: Manual Input */}
                {searchMethod === 'manual' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                            Paste Papers (Title & Abstract)
                        </label>
                        <textarea
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            rows={8}
                            placeholder={`Title 1\nAbstract content goes here...\n\nTitle 2\nAbstract content goes here...`}
                            className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white font-mono"
                        ></textarea>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Format: Separate papers with an empty line. The first line of each block is treated as the Title, the rest as the Abstract.
                        </p>
                    </div>
                )}

                {/* Method 4: File Upload */}
                {searchMethod === 'upload' && (
                    <div className="animate-in fade-in duration-300 mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                            Upload File (JSON or CSV)
                        </label>
                        <input 
                            type="file" 
                            accept=".json,.csv"
                            onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 p-2"
                        />
                         <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Supported Formats:<br/>
                            1. <b>CSV</b> with headers including 'Title' and 'Abstract' (optional 'Year', 'Journal').<br/>
                            2. <b>JSON</b> array of objects with title, abstract, year, journal fields.
                        </p>
                    </div>
                )}

                <div className="flex justify-end items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={handleSearch}
                        disabled={isSearching || (searchMethod === 'builder' && !coreTerm) || (searchMethod === 'import' && !importInput) || (searchMethod === 'manual' && !manualInput) || (searchMethod === 'upload' && !fileToUpload)}
                        className="text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800 disabled:opacity-50 flex items-center"
                    >
                        {isSearching ? 'Processing...' : (
                            <>
                                {searchMethod === 'builder' ? <Search size={18} className="mr-2"/> : 
                                 searchMethod === 'import' ? <List size={18} className="mr-2"/> : 
                                 searchMethod === 'upload' ? <Upload size={18} className="mr-2"/> :
                                 <FileText size={18} className="mr-2"/>} 
                                
                                {searchMethod === 'builder' ? 'Execute Search' : 
                                 searchMethod === 'import' ? 'Fetch Papers' : 
                                 searchMethod === 'upload' ? 'Parse & Load' :
                                 'Parse & Load'}
                            </>
                        )}
                    </button>
                </div>
              </div>

              {/* Results */}
              {(papers.length > 0 || totalCount > 0) && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Results <span className="text-sm font-normal text-gray-500 ml-2">({totalCount} papers found)</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                       {/* Open in PubMed Button - Only for PubMed based searches */}
                       {searchMethod !== 'manual' && searchMethod !== 'upload' && (
                         <button 
                           onClick={openPubMedSearch}
                           className="flex items-center px-3 py-1 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
                           title="View these results on PubMed"
                         >
                            <Globe size={16} className="mr-1"/> Open in PubMed
                         </button>
                       )}
                       <button className="flex items-center px-3 py-1 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200">
                          <Download size={16} className="mr-1"/> Export CSV
                       </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {papers.length === 0 && isSearching ? (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                    ) : (
                        displayPapers.map((paper, idx) => (
                        <div key={paper.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                            <div className="flex justify-between items-start">
                            <h4 className="text-md font-semibold text-primary-600 dark:text-primary-400 mb-1 w-full">
                                <span className="mr-2 text-gray-500 dark:text-gray-400 font-normal text-sm">{idx + 1 + (currentPage-1)*pageSize}.</span>
                                <HoverableText text={paper.title} className="inline" />
                            </h4>
                            {paper.id.startsWith('manual') || paper.id.startsWith('file') ? null : (
                                <a 
                                    href={`https://pubmed.ncbi.nlm.nih.gov/${paper.id}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white flex-shrink-0 ml-2"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            {paper.year} | <span className="italic">{paper.journal}</span> | {paper.authors ? paper.authors.join(", ") : 'Unknown Authors'}
                            </p>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                            <HoverableText text={paper.abstract} />
                            </div>
                        </div>
                        ))
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-center items-center mt-6 space-x-4">
                    <button 
                      onClick={() => loadPage(currentPage - 1)}
                      disabled={currentPage === 1 || isSearching}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 dark:text-white"
                    >
                      <ChevronLeft />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                    </span>
                    <button 
                      onClick={() => loadPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalCount / pageSize) || isSearching}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 dark:text-white"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANALYSIS MODE */}
          {mode === AppMode.ANALYSIS && (
            <div className="space-y-6">
              
              {/* Configuration Panel */}
              {!isAnalyzing && !analysisResult && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mb-6">
                          <Settings className="mr-2" /> Analysis Configuration
                      </h2>
                      
                      <div className="space-y-6 max-w-2xl">
                          <div>
                              <div className="flex justify-between mb-2">
                                  <label className="text-sm font-medium text-gray-900 dark:text-white">Creativity / Speculation</label>
                                  <span className="text-sm text-gray-500">{(analysisConfig.creativity * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                  type="range" 
                                  min="0" max="1" step="0.1" 
                                  value={analysisConfig.creativity}
                                  onChange={(e) => setAnalysisConfig({...analysisConfig, creativity: parseFloat(e.target.value)})}
                                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                              />
                              <p className="text-xs text-gray-500 mt-1">Lower for strict factual grouping, higher for novel theoretical connections.</p>
                          </div>

                          <div>
                              <div className="flex justify-between mb-2">
                                  <label className="text-sm font-medium text-gray-900 dark:text-white">Depth / Granularity</label>
                                  <span className="text-sm text-gray-500">{(analysisConfig.depth * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                  type="range" 
                                  min="0" max="1" step="0.1" 
                                  value={analysisConfig.depth}
                                  onChange={(e) => setAnalysisConfig({...analysisConfig, depth: parseFloat(e.target.value)})}
                                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                              />
                              <p className="text-xs text-gray-500 mt-1">Adjust the level of detail in topic descriptions and analysis.</p>
                          </div>

                          <div>
                              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Analytical Focus</label>
                              <div className="flex space-x-2">
                                  {['broad', 'balanced', 'specific'].map((f) => (
                                      <button
                                          key={f}
                                          onClick={() => setAnalysisConfig({...analysisConfig, focus: f as any})}
                                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                              analysisConfig.focus === f 
                                              ? 'bg-primary-600 text-white' 
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                          }`}
                                      >
                                          {f}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="pt-4">
                              <button 
                                  onClick={handleAnalyze}
                                  className="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-lg px-5 py-3 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800 flex items-center justify-center"
                              >
                                  <Brain className="mr-2" /> Start AI Analysis
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* Processing Visualization */}
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center h-80 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                   <div className="relative w-24 h-24 mb-6">
                       <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                       <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                       <Brain className="absolute inset-0 m-auto text-primary-600" size={32} />
                   </div>
                   
                   <div className="space-y-4 w-64">
                       <div className={`flex items-center transition-opacity duration-300 ${processingStep >= 0 ? 'opacity-100' : 'opacity-30'}`}>
                           <div className={`w-3 h-3 rounded-full mr-3 ${processingStep > 0 ? 'bg-green-500' : 'bg-primary-500 animate-pulse'}`}></div>
                           <span className="text-sm font-medium dark:text-white">Ingesting Paper Data...</span>
                       </div>
                       <div className={`flex items-center transition-opacity duration-300 ${processingStep >= 1 ? 'opacity-100' : 'opacity-30'}`}>
                           <div className={`w-3 h-3 rounded-full mr-3 ${processingStep > 1 ? 'bg-green-500' : (processingStep === 1 ? 'bg-primary-500 animate-pulse' : 'bg-gray-300')}`}></div>
                           <span className="text-sm font-medium dark:text-white">Clustering Semantic Topics...</span>
                       </div>
                       <div className={`flex items-center transition-opacity duration-300 ${processingStep >= 2 ? 'opacity-100' : 'opacity-30'}`}>
                           <div className={`w-3 h-3 rounded-full mr-3 ${processingStep > 2 ? 'bg-green-500' : (processingStep === 2 ? 'bg-primary-500 animate-pulse' : 'bg-gray-300')}`}></div>
                           <span className="text-sm font-medium dark:text-white">Calculating Novelty Scores...</span>
                       </div>
                       <div className={`flex items-center transition-opacity duration-300 ${processingStep >= 3 ? 'opacity-100' : 'opacity-30'}`}>
                           <div className={`w-3 h-3 rounded-full mr-3 ${processingStep === 3 ? 'bg-primary-500 animate-pulse' : 'bg-gray-300'}`}></div>
                           <span className="text-sm font-medium dark:text-white">Synthesizing Insights...</span>
                       </div>
                   </div>
                </div>
              )}

              {!isAnalyzing && analysisResult && (
                <>
                  {/* Action Bar (Export/New Analysis) */}
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 print:hidden">
                      <button 
                        onClick={() => setAnalysisResult(null)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-sm"
                      >
                          <ChevronLeft size={16} className="mr-1" /> New Analysis
                      </button>
                      <div className="relative">
                          <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                          >
                              <Download size={18} className="mr-2" /> Export Result
                              <ChevronDown size={16} className="ml-2" />
                          </button>
                          
                          {showExportMenu && (
                              <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-20 overflow-hidden">
                                  <button onClick={() => handleExport('html')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center text-sm dark:text-white font-semibold text-primary-600 dark:text-primary-400">
                                      <FileCode size={16} className="mr-2" /> HTML Report (Full)
                                  </button>
                                  <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                  <button onClick={() => handleExport('markdown')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center text-sm dark:text-white">
                                      <FileText size={16} className="mr-2 text-gray-500 dark:text-gray-300" /> Markdown
                                  </button>
                                  <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center text-sm dark:text-white">
                                      <FileJson size={16} className="mr-2 text-yellow-500" /> JSON
                                  </button>
                                  <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center text-sm dark:text-white">
                                      <FileType size={16} className="mr-2 text-green-500" /> CSV
                                  </button>
                                  <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                  <button onClick={handlePrint} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center text-sm dark:text-white">
                                      <Printer size={16} className="mr-2 text-blue-500" /> Print / PDF
                                  </button>
                              </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Results Container wrapped in ref for HTML export */}
                  <div ref={resultsRef} className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-lg shadow-lg text-white print:break-inside-avoid">
                        <h2 className="text-2xl font-bold mb-2 flex items-center">
                        <BookOpen className="mr-2" /> AI Research Summary
                        </h2>
                        <p className="opacity-90 text-lg leading-relaxed whitespace-pre-wrap">
                        {analysisResult.summary}
                        </p>
                    </div>

                    {/* Thinking Process / Methodology */}
                    {analysisResult.methodology && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 print:break-inside-avoid">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                                <Brain size={14} className="mr-1" /> Analysis Logic
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                                "{analysisResult.methodology}"
                            </p>
                        </div>
                    )}

                    {/* Emerging Topics (Eartopics) Card */}
                    {analysisResult.emergingTopics && analysisResult.emergingTopics.length > 0 && (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-6 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800 print:break-inside-avoid">
                            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center mb-4">
                                <Zap className="mr-2 text-yellow-500" /> Emerging Frontiers (Eartopics)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {analysisResult.emergingTopics.map((topic, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => setSelectedTopic(topic)}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm border border-indigo-50 dark:border-gray-700 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-indigo-700 dark:text-indigo-300">{topic.name}</h4>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                                {(topic.potentialScore * 10).toFixed(1)}/10
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-3">{topic.reason}</p>
                                        <p className="text-xs text-blue-500 font-medium no-print">Click to see evidence papers &rarr;</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
                        <div className="print:break-inside-avoid"><BubbleChart topics={analysisResult.topics} onTopicClick={setSelectedTopic} isPrinting={isPrinting} /></div>
                        <div className="print:mt-6 print:break-inside-avoid"><RadarChartComponent topics={analysisResult.topics} isPrinting={isPrinting} /></div>
                    </div>

                    {/* New Word Cloud Component */}
                    <div className="print:break-inside-avoid">
                       <WordCloud topics={analysisResult.topics} onTopicClick={setSelectedTopic} />
                    </div>

                    {/* Trend Line Chart */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 print:break-inside-avoid">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Topic Evolution Trends</h3>
                        <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analysisResult.trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="year" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <LineTooltip 
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                />
                                <LineLegend />
                                {Array.from(new Set(analysisResult.trendData.map(d => d.topic))).map((topic, i) => (
                                <Line 
                                    key={topic} 
                                    type="monotone" 
                                    dataKey="count" 
                                    data={analysisResult.trendData.filter(d => d.topic === topic)}
                                    name={topic} 
                                    stroke={['#FF4B4B', '#2ECC71', '#F1C40F', '#95A5A6', '#3498DB'][i % 5]} 
                                    strokeWidth={2}
                                    isAnimationActive={!isPrinting}
                                />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Topic Details Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                            <th className="px-6 py-3">Topic</th>
                            <th className="px-6 py-3">Keywords</th>
                            <th className="px-6 py-3">Impact</th>
                            <th className="px-6 py-3">Novelty</th>
                            <th className="px-6 py-3">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analysisResult.topics.map((topic) => (
                            <tr 
                                key={topic.id} 
                                onClick={() => setSelectedTopic(topic)}
                                className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                            >
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {topic.name}
                                    <span className="block text-xs text-blue-500 mt-1 sm:hidden no-print">Click for details</span>
                                </td>
                                <td className="px-6 py-4">{topic.keywords.slice(0, 3).join(", ")}</td>
                                <td className="px-6 py-4">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${topic.impact * 100}%` }}></div>
                                </div>
                                </td>
                                <td className="px-6 py-4">{(topic.novelty * 10).toFixed(1)}/10</td>
                                <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold 
                                    ${topic.trend === 'rising' ? 'bg-green-100 text-green-800' : 
                                    topic.trend === 'declining' ? 'bg-red-100 text-red-800' : 
                                    'bg-gray-100 text-gray-800'}`}>
                                    {topic.trend.toUpperCase()}
                                </span>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TREND ANALYSIS MODE */}
          {mode === AppMode.TREND_ANALYSIS && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mb-6">
                        <TrendingUp className="mr-2"/> Research Hotspot & Trend Analysis
                     </h2>

                     <div className="grid grid-cols-1 gap-6">
                         <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Research Field</label>
                            <input 
                                type="text" 
                                value={trendField}
                                onChange={(e) => setTrendField(e.target.value)}
                                placeholder="e.g. Immunotherapy in Lung Cancer"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            />
                         </div>
                         <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Hotspot Data (CSV, Excel paste, etc.)</label>
                             <textarea
                                value={trendInput}
                                onChange={(e) => setTrendInput(e.target.value)}
                                rows={8}
                                placeholder="Paste your data table here (Top 10 keywords, Indices, Novelty scores, etc.)..."
                                className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white font-mono"
                            ></textarea>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                The AI will assume the role of a Senior Medical Journal Editor to interpret this data.
                            </p>
                         </div>
                     </div>

                     <div className="flex justify-end mt-6">
                         <button 
                            onClick={handleTrendAnalysis}
                            disabled={isTrendAnalyzing || !trendField || !trendInput}
                            className="text-white bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-purple-600 dark:hover:bg-purple-700 focus:outline-none dark:focus:ring-purple-800 disabled:opacity-50 flex items-center"
                        >
                             {isTrendAnalyzing ? 'Analyzing Trends...' : (
                                <>
                                  <TrendingUp size={18} className="mr-2"/> Analyze Hotspots
                                </>
                             )}
                        </button>
                     </div>
                </div>

                {isTrendAnalyzing && (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-300">Editor is reviewing your data...</p>
                    </div>
                )}

                {trendResult && !isTrendAnalyzing && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* 1. Trend Judgment */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-4">
                                <Activity className="mr-2 text-blue-500"/> Trend Judgment: Frontiers vs. Classics
                            </h3>
                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {trendResult.trendJudgment}
                            </div>
                        </div>

                        {/* 2. Deep Dive */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-l-4 border-l-purple-500 border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-4">
                                <Zap className="mr-2 text-purple-500"/> Deep Dive: The #1 Hotspot
                            </h3>
                             <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {trendResult.deepDive}
                            </div>
                        </div>

                        {/* 3. Abstract */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-l-4 border-l-green-500 border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center mb-4">
                                <Feather className="mr-2 text-green-500"/> Academic Abstract (Results Section)
                            </h3>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 font-serif text-lg leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {trendResult.abstractSection}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}
        </div>
        
        {/* Topic Detail Modal */}
        {selectedTopic && (
            <TopicDetailModal 
                topic={selectedTopic} 
                allPapers={papers} 
                trendData={analysisResult?.trendData} // Pass trendData here
                onClose={() => setSelectedTopic(null)} 
            />
        )}

      </div>
    </div>
  );
}