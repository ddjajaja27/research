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
      <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col relative overflow-hidden">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Top 3 Topics Comparison</h3>
        <div className="flex-1 relative flex items-center justify-center animate-pulse">
             {/* Skeleton Radar Shape */}
             <div className="w-48 h-48 border-2 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center">
                 <div className="w-32 h-32 border-2 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center">
                      <div className="w-16 h-16 border-2 border-gray-200 dark:border-gray-700 rounded-full"></div>
                 </div>
             </div>
             {/* Random Polygons mimicking radar areas */}
             <div className="absolute w-32 h-32 bg-blue-100 dark:bg-blue-900/20 opacity-50 rotate-12 transform" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
        </div>

        {/* Loading Overlay Label */}
        <div className="absolute inset-0 flex items-center justify-center">
             <div className="bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm flex items-center border border-gray-100 dark:border-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Analyzing metrics...</span>
             </div>
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