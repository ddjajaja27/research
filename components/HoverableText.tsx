import React, { useState, useRef } from 'react';
import { translateText } from '../services/geminiService';

const Sentence: React.FC<{ text: string }> = ({ text }) => {
  const [translation, setTranslation] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<any>(null); 

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(async () => {
      setShowTooltip(true);
      if (!translation && !loading) {
        setLoading(true);
        const res = await translateText(text);
        setTranslation(res);
        setLoading(false);
      }
    }, 600); 
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  return (
    <span 
      className="relative inline hover:bg-primary-100 dark:hover:bg-primary-900/50 cursor-help rounded px-0.5 transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-black rounded-md shadow-xl z-50 pointer-events-none border border-gray-700 min-w-[250px] max-w-[400px] text-center whitespace-normal">
          {loading ? (
             <span className="animate-pulse">Translating...</span>
          ) : (
             <span className="font-medium leading-relaxed">{translation || 'No translation'}</span>
          )}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-black"></span>
        </span>
      )}
    </span>
  );
};

export const HoverableText: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
  // Use Intl.Segmenter if available for robust sentence splitting, otherwise regex
  let segments: string[] = [];

  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
    segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
  } else {
    // Fallback split by punctuation followed by space or end of line
    segments = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  }

  return (
    <div className={className}>
      {segments.map((seg, idx) => (
        <Sentence key={idx} text={seg} />
      ))}
    </div>
  );
};