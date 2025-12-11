'use client';
import React, { useEffect, useState } from 'react';
import { translateText } from '../services/geminiService';
import { createPortal } from 'react-dom';

export const GlobalSelectionTranslator: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [translation, setTranslation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const handleMouseUp = async (event: MouseEvent) => {
      debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 2) return;

        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const top = rect.top + window.scrollY - 10;
        const left = rect.left + window.scrollX + (rect.width / 2);

        setPosition({ top, left });
        setVisible(true);
        setLoading(true);
        setTranslation('');

        try {
          const result = await translateText(text);
          setTranslation(result);
        } catch (e) {
          setTranslation('Translation failed');
        } finally {
          setLoading(false);
        }
      }, 200);
    };

    const handleMouseDown = (event: MouseEvent) => {
      clearTimeout(debounceTimer);
      const tooltip = document.getElementById('global-translator-tooltip');
      if (tooltip && tooltip.contains(event.target as Node)) return;
      setVisible(false);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!visible) return null;

  return createPortal(
    <div 
      id="global-translator-tooltip"
      style={{ top: position.top, left: position.left, transform: 'translate(-50%, -100%)' }}
      className="absolute z-[9999] mb-2 px-3 py-2 text-sm text-white bg-gray-900/95 dark:bg-black/95 rounded-md shadow-2xl border border-gray-700 backdrop-blur-sm min-w-[200px] max-w-[400px] pointer-events-auto"
    >
      {loading ? "Translating..." : (
        <div className="flex flex-col">
           <div className="max-h-64 overflow-y-auto text-left leading-relaxed">{translation}</div>
           <div className="text-[10px] text-gray-400 mt-2 pt-1 border-t border-gray-700 flex justify-between">
             <span>Gemini AI</span>
             <span className="cursor-pointer hover:text-white" onClick={() => setVisible(false)}>Close</span>
           </div>
        </div>
      )}
    </div>,
    document.body
  );
};