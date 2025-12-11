import React from 'react';
import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TopicCluster } from '../types';

interface RadarChartProps {
  topics: TopicCluster[];
  isLoading?: boolean;
  isPrinting?: boolean;
}

const COLORS = ['#FF4B4B', '#2ECC71', '#3498DB'];

export const RadarChartComponent: React.FC<RadarChartProps> = ({ topics, isLoading, isPrinting }) => {
  if (isLoading) {
    return (
      <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Top 3 Topics Comparison</h3>
        <div className="flex-1 flex flex-col items-center justify-center opacity-60">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
           <p className="text-sm text-gray-500">Analyzing metrics...</p>
        </div>
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Top 3 Topics Comparison</h3>
        <div className="flex-1 flex items-center justify-center text-gray-400">
           <p className="text-sm">No topics available to compare.</p>
        </div>
      </div>
    );
  }

  // Take top 3 topics for clarity
  const topTopics = [...topics].sort((a, b) => b.volume - a.volume).slice(0, 3);

  const data = [
    { subject: 'Novelty', fullMark: 1 },
    { subject: 'Impact', fullMark: 1 },
    { subject: 'Volume', fullMark: 20 }, // Normalized volume scale conceptually
  ];

  // We need to transform data structure for Recharts Radar
  // Recharts radar expects data = [{ subject: 'Novelty', T1: 0.8, T2: 0.5 }, ...]
  
  const transformedData = data.map(dim => {
    const point: any = { subject: dim.subject };
    topTopics.forEach(t => {
      if (dim.subject === 'Novelty') point[t.id] = t.novelty;
      if (dim.subject === 'Impact') point[t.id] = t.impact;
      if (dim.subject === 'Volume') point[t.id] = Math.min(t.volume / 10, 1); // Normalize volume
    });
    return point;
  });

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Top 3 Topics Comparison</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="80%" data={transformedData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
          {topTopics.map((topic, index) => (
            <Radar
              key={topic.id}
              name={topic.name}
              dataKey={topic.id}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.4}
              isAnimationActive={!isPrinting}
            />
          ))}
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
};