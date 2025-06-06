import React from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

export const GlobalBackground: React.FC = () => {
  const { isOverlayVisible } = useBackground();

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      {/* Blue Blob */}
      <div className="absolute top-1/3 right-1/4 w-64 h-64 sm:w-72 sm:h-72 md:w-[800px] md:h-[800px] bg-blue-500 rounded-full opacity-30 dark:opacity-60 mix-blend-multiply dark:mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
      {/* Green Blob */}
      <div className="absolute bottom-1/3 left-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-[800px] md:h-[800px] bg-green-500 rounded-full opacity-30 dark:opacity-60 mix-blend-multiply dark:mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
      {/* Red Blob */}
      <div className="absolute bottom-1/4 right-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-[800px] md:h-[800px] bg-red-500 rounded-full opacity-30 dark:opacity-60 mix-blend-multiply dark:mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
      <div className="absolute top-1/4 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-[800px] md:h-[800px] bg-red-500 rounded-full opacity-30 dark:opacity-60 mix-blend-multiply dark:mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
      {/* Yellow Blob */}
      <div className="absolute bottom-1/4 left-1/3 w-56 h-56 sm:w-64 sm:h-64 md:w-[800px] md:h-[800px] bg-yellow-400 rounded-full opacity-30 dark:opacity-60 mix-blend-multiply dark:mix-blend-lighten filter blur-2xl sm:blur-10xl md:blur-[300px] animate-blob-3"></div>

      {/* Overlay */}
      {isOverlayVisible && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm"></div>
      )}
    </div>
  );
}; 