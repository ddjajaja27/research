'use client';
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
  if (isLoading || !topics || topics.length === 0) return <div className="h-[400px] w-full bg-white dark:bg-gray-800 rounded border dark:border-gray-700"></div>;

  const topTopics = [...topics].sort((a, b) => b.volume - a.volume).slice(0, 3);
  const data = [
    { subject: 'Novelty', fullMark: 1 },
    { subject: 'Impact', fullMark: 1 },
    { subject: 'Volume', fullMark: 20 },
  ];

  const transformedData = data.map(dim => {
    const point: any = { subject: dim.subject };
    topTopics.forEach(t => {
      if (dim.subject === 'Novelty') point[t.id] = t.novelty;
      if (dim.subject === 'Impact') point[t.id] = t.impact;
      if (dim.subject === 'Volume') point[t.id] = Math.min(t.volume / 10, 1);
    });
    return point;
  });

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="80%" data={transformedData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
          <Tooltip />
          <Legend />
          {topTopics.map((topic, index) => (
            <Radar key={topic.id} name={topic.name} dataKey={topic.id} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.4} isAnimationActive={!isPrinting} />
          ))}
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
};