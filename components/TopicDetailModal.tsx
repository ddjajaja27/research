import React, { useState, useMemo } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight, Highlighter, TrendingUp } from 'lucide-react';
import { Paper, TopicCluster, EmergingTopic } from '../types';
import { HoverableText } from './HoverableText';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';

interface TopicDetailModalProps {
  topic: TopicCluster | EmergingTopic;
  allPapers: Paper[];
  trendData?: { year: number; topic: string; count: number }[];
  onClose: () => void;
}

export const TopicDetailModal: React.FC<TopicDetailModalProps> = ({ topic, allPapers, trendData = [], onClose }) => {
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Filter papers that belong to this topic
  const relatedPapers = useMemo(() => {
    if (!topic.paperIds || topic.paperIds.length === 0) return [];
    // Map IDs to actual paper objects
    return topic.paperIds
      .map(id => allPapers.find(p => p.id === id))
      .filter((p): p is Paper => p !== undefined);
  }, [topic, allPapers]);

  // Filter trend data for this specific topic
  const topicTrend = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return trendData
      .filter(d => d.topic === topic.name)
      .sort((a, b) => a.year - b.year);
  }, [trendData, topic.name]);

  const totalPages = Math.ceil(relatedPapers.length / pageSize);
  const currentPapers = relatedPapers.slice((page - 1) * pageSize, page * pageSize);

  // Helper to highlight keywords in abstract
  const HighlightedAbstract: React.FC<{ text: string, keywords: string[] }> = ({ text, keywords }) => {
    if (!keywords || keywords.length === 0) return <HoverableText text={text} />;
    
    const parts = text.split(new RegExp(`(${keywords.join('|')})`, 'gi'));
    
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {parts.map((part, i) => {
           const isMatch = keywords.some(k => k.toLowerCase() === part.toLowerCase());
           if (isMatch) {
             return <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 rounded px-0.5">{part}</mark>;
           }
           return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  // Keywords to highlight: use topic keywords or name parts
  const highlightTerms = useMemo(() => {
      let terms: string[] = [];
      if ('keywords' in topic) {
          terms = [...topic.keywords];
      }
      // Add words from name
      terms.push(...topic.name.split(' ').filter(w => w.length > 3));
      return terms;
  }, [topic]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 pr-6">
            <div className="flex items-center gap-2 mb-2">
               <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-100 rounded-full dark:bg-primary-900 dark:text-primary-300">
                 Research Front
               </span>
               {'novelty' in topic && (
                   <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 rounded-full dark:bg-purple-900 dark:text-purple-300">
                     Novelty: {(topic.novelty * 10).toFixed(1)}
                   </span>
               )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {topic.name}
            </h2>
            {'description' in topic && (
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {topic.description}
                </p>
            )}
             {'reason' in topic && (
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {topic.reason}
                </p>
            )}

            {/* Mini Trend Chart */}
            {topicTrend.length > 1 && (
                <div className="mt-4 h-24 w-full max-w-md bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2 border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                       <TrendingUp size={10} className="mr-1" /> Topic Evolution ({topicTrend[0].year}-{topicTrend[topicTrend.length-1].year})
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                       <AreaChart data={topicTrend}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                          <XAxis 
                            dataKey="year" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#9ca3af'}} 
                            interval="preserveStartEnd"
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                            itemStyle={{ padding: 0, color: '#3b82f6' }}
                            labelStyle={{ color: '#6b7280', marginBottom: '2px' }}
                            formatter={(value: any) => [`${value} papers`, 'Volume']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                          />
                       </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
           <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
             <Highlighter size={14} className="mr-2" /> Key Evidence Papers ({relatedPapers.length})
           </h3>

           {relatedPapers.length === 0 ? (
               <div className="text-center py-10 text-gray-500">
                   No specific papers were directly linked to this insight by the AI.
               </div>
           ) : (
               <div className="space-y-4">
                   {currentPapers.map((paper) => (
                       <div key={paper.id} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md">
                           <div className="flex justify-between items-start mb-2">
                               <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 mr-4">
                                   {paper.title}
                               </h4>
                               <a 
                                    href={`https://pubmed.ncbi.nlm.nih.gov/${paper.id}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 flex-shrink-0"
                                    title="View on PubMed"
                                >
                                    <ExternalLink size={18} />
                                </a>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono">
                                {paper.year} | {paper.journal} | PMID: {paper.id}
                           </p>
                           <HighlightedAbstract text={paper.abstract} keywords={highlightTerms} />
                       </div>
                   ))}
               </div>
           )}
        </div>

        {/* Footer - Pagination */}
        {relatedPapers.length > pageSize && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 rounded-b-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, relatedPapers.length)} of {relatedPapers.length} papers
                </span>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-white"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-white"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
