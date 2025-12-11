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
      // Small delay to ensure selection is final and not a click
      debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (!text || text.length === 0) {
          // No text selected, do nothing (mousedown handles hiding)
          return;
        }

        // Basic filter: skip very short selections to avoid accidental triggers
        if (text.length < 2) return;

        // Calculate position
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
          console.error(e);
          setTranslation('Translation failed');
        } finally {
          setLoading(false);
        }
      }, 200);
    };

    const handleMouseDown = (event: MouseEvent) => {
      clearTimeout(debounceTimer);
      const tooltip = document.getElementById('global-translator-tooltip');
      // If clicking inside the tooltip, don't hide it
      if (tooltip && tooltip.contains(event.target as Node)) {
        return;
      }
      // Hide on new interaction outside
      setVisible(false);
    };

    const handleSelectionChange = () => {
        // Optional: Hide tooltip if selection is cleared?
        // Usually mousedown handles this.
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  if (!visible) return null;

  return createPortal(
    <div 
      id="global-translator-tooltip"
      style={{ 
        top: position.top, 
        left: position.left,
        transform: 'translate(-50%, -100%)'
      }}
      className="absolute z-[9999] mb-2 px-3 py-2 text-sm text-white bg-gray-900/95 dark:bg-black/95 rounded-md shadow-2xl border border-gray-700 backdrop-blur-sm min-w-[200px] max-w-[400px] pointer-events-auto"
    >
      {loading ? (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          <span>Translating...</span>
        </div>
      ) : (
        <div className="flex flex-col">
           <div className="max-h-64 overflow-y-auto text-left leading-relaxed">
             {translation}
           </div>
           <div className="text-[10px] text-gray-400 mt-2 pt-1 border-t border-gray-700 flex justify-between">
             <span>Gemini AI</span>
             <span className="cursor-pointer hover:text-white" onClick={() => setVisible(false)}>Close</span>
           </div>
        </div>
      )}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/95 dark:border-t-black/95"></div>
    </div>,
    document.body
  );
};
