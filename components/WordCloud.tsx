'use client';
import React, { useMemo } from 'react';
import { TopicCluster } from '../types';

interface WordCloudProps {
  topics: TopicCluster[];
  onTopicClick?: (topic: TopicCluster) => void;
}

const COLORS = ['#FF4B4B', '#2ECC71', '#F1C40F', '#95A5A6', '#3498DB', '#9B59B6', '#8E44AD', '#E67E22'];

export const WordCloud: React.FC<WordCloudProps> = ({ topics, onTopicClick }) => {
  const words = useMemo(() => {
    const allKeywords: { text: string; topicId: string; size: number; color: string; topic: TopicCluster }[] = [];
    let maxVolume = 0;
    let minVolume = Infinity;

    topics.forEach(t => {
      maxVolume = Math.max(maxVolume, t.volume);
      minVolume = Math.min(minVolume, t.volume);
    });

    topics.forEach((topic, index) => {
      const normalizedVol = (topic.volume - minVolume) / (maxVolume - minVolume || 1);
      const weight = 0.5 + (normalizedVol * 0.5) + (topic.impact * 0.3);
      const color = COLORS[index % COLORS.length];

      topic.keywords.forEach(keyword => {
        allKeywords.push({ text: keyword, topicId: topic.id, size: weight, color: color, topic: topic });
      });
    });

    return allKeywords.sort(() => Math.random() - 0.5);
  }, [topics]);

  const minFontSize = 0.8;
  const maxFontSize = 2.0;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        {words.map((word, idx) => {
          const fontSize = `${minFontSize + (word.size * (maxFontSize - minFontSize))}rem`;
          return (
            <span
              key={`${word.text}-${idx}`}
              onClick={() => onTopicClick && onTopicClick(word.topic)}
              style={{ fontSize, color: word.color, opacity: 0.85 }}
              className="cursor-pointer font-bold hover:opacity-100 hover:scale-110 transition-all duration-200 select-none whitespace-nowrap"
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};