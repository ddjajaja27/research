'use client';
import React, { useState, useMemo } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight, Highlighter, TrendingUp } from 'lucide-react';
import { Paper, TopicCluster, EmergingTopic } from '../types';
import { HoverableText } from './HoverableText';
import { ResponsiveContainer, Area, AreaChart, XAxis, Tooltip, CartesianGrid } from 'recharts';

interface TopicDetailModalProps {
  topic: TopicCluster | EmergingTopic;
  allPapers: Paper[];
  trendData?: { year: number; topic: string; count: number }[];
  onClose: () => void;
}

export const TopicDetailModal: React.FC<TopicDetailModalProps> = ({ topic, allPapers, trendData = [], onClose }) => {
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const relatedPapers = useMemo(() => {
    if (!topic.paperIds || topic.paperIds.length === 0) return [];
    return topic.paperIds.map(id => allPapers.find(p => p.id === id)).filter((p): p is Paper => p !== undefined);
  }, [topic, allPapers]);

  const topicTrend = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return trendData.filter(d => d.topic === topic.name).sort((a, b) => a.year - b.year);
  }, [trendData, topic.name]);

  const totalPages = Math.ceil(relatedPapers.length / pageSize);
  const currentPapers = relatedPapers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 pr-6">
             <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{topic.name}</h2>
             {topicTrend.length > 1 && (
                <div className="mt-4 h-24 w-full max-w-md bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2 border border-gray-100 dark:border-gray-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={topicTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                       </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
           {currentPapers.map((paper) => (
               <div key={paper.id} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
                   <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{paper.title}</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono">{paper.year} | {paper.journal}</p>
                   <HoverableText text={paper.abstract} className="text-sm text-gray-700 dark:text-gray-300" />
               </div>
           ))}
        </div>
        
        {relatedPapers.length > pageSize && (
            <div className="p-4 border-t flex justify-between bg-white dark:bg-gray-800 rounded-b-xl">
                <span>Page {page} of {totalPages}</span>
                <div className="flex space-x-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={20} /></button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={20} /></button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};