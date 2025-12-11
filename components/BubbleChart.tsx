'use client';
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { TopicCluster } from '../types';

// ... [Content identical to previous BubbleChart.tsx] ...
// Re-exporting with 'use client' at the top is the key change.

interface BubbleChartProps {
  topics: TopicCluster[];
  onTopicClick?: (topic: TopicCluster) => void;
  isLoading?: boolean;
  isPrinting?: boolean;
}

const COLORS = ['#FF4B4B', '#2ECC71', '#F1C40F', '#95A5A6', '#3498DB', '#9B59B6'];

export const BubbleChart: React.FC<BubbleChartProps> = ({ topics, onTopicClick, isLoading, isPrinting }) => {
  if (isLoading) {
      return <div className="animate-pulse bg-gray-100 h-[400px] w-full rounded"></div>;
  }
  if (!topics || topics.length === 0) return <div className="h-[400px] w-full bg-white dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-center">No Data</div>;

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis type="number" dataKey="novelty" name="Novelty" domain={[0, 1]} />
          <YAxis type="number" dataKey="impact" name="Impact" domain={[0, 1]} />
          <ZAxis type="number" dataKey="volume" range={[100, 1000]} name="Volume" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Scatter name="Topics" data={topics} fill="#8884d8" isAnimationActive={!isPrinting} onClick={(data) => {
              if (onTopicClick && data) {
                  // @ts-ignore
                  const topic = data.payload || data;
                  onTopicClick(topic as TopicCluster);
              }
          }}>
            {topics.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};