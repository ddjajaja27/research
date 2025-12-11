import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { TopicCluster } from '../types';

interface BubbleChartProps {
  topics: TopicCluster[];
  onTopicClick?: (topic: TopicCluster) => void;
  isLoading?: boolean;
  isPrinting?: boolean;
}

const COLORS = ['#FF4B4B', '#2ECC71', '#F1C40F', '#95A5A6', '#3498DB', '#9B59B6'];

export const BubbleChart: React.FC<BubbleChartProps> = ({ topics, onTopicClick, isLoading, isPrinting }) => {
  if (isLoading) {
    return (
      <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Research Frontier Matrix</h3>
        <div className="flex-1 flex flex-col items-center justify-center opacity-60">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
           <p className="text-sm text-gray-500">Visualizing clusters...</p>
        </div>
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Research Frontier Matrix</h3>
        <div className="flex-1 flex items-center justify-center text-gray-400">
           <p className="text-sm">No topics available to visualize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Research Frontier Matrix</h3>
      <p className="text-xs text-gray-500 mb-2">Click on a bubble to see contributing papers.</p>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis 
            type="number" 
            dataKey="novelty" 
            name="Novelty" 
            domain={[0, 1]} 
            tickFormatter={(value) => value.toFixed(1)}
            label={{ value: 'Novelty (Innovation)', position: 'insideBottom', offset: -10 }} 
          />
          <YAxis 
            type="number" 
            dataKey="impact" 
            name="Impact" 
            domain={[0, 1]} 
            tickFormatter={(value) => value.toFixed(1)}
            label={{ value: 'Impact Factor', angle: -90, position: 'insideLeft' }} 
          />
          <ZAxis type="number" dataKey="volume" range={[100, 1000]} name="Volume" />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as TopicCluster;
                return (
                  <div className="bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded text-sm z-50">
                    <p className="font-bold text-gray-900 dark:text-white">{data.name}</p>
                    <p className="text-gray-600 dark:text-gray-400">Novelty: {data.novelty.toFixed(2)}</p>
                    <p className="text-gray-600 dark:text-gray-400">Impact: {data.impact.toFixed(2)}</p>
                    <p className="text-gray-600 dark:text-gray-400">Trend: {data.trend}</p>
                    <p className="text-xs text-gray-500 mt-1">{data.description}</p>
                    <p className="text-xs text-blue-500 mt-2 font-semibold">Click for details</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Scatter 
            name="Topics" 
            data={topics} 
            fill="#8884d8" 
            isAnimationActive={!isPrinting}
            onClick={(data) => {
              // Recharts passes the event/data a bit differently depending on version, 
              // but onClick on Scatter often returns the point data in `payload` or directly.
              if (onTopicClick && data) {
                  // @ts-ignore
                  const topic = data.payload || data; 
                  if (topic) onTopicClick(topic as TopicCluster);
              }
          }}>
            {topics.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};