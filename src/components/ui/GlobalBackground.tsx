import React from 'react';
import { useBackground } from '../../contexts/BackgroundContext.tsx';
import { cn } from '../../lib/utils.ts';

const animationClasses = {
  static: 'animate-none',
  slow: 'animate-blob-3',
  normal: 'animate-blob-2',
  fast: 'animate-blob-1',
  'animate-blob-1': 'animate-blob-1',
  'animate-blob-2': 'animate-blob-2',
  'animate-blob-3': 'animate-blob-3',
};

const Blob = ({
  color,
  animationClass,
  top,
  left,
  animationDelay,
  size,
}: {
  color: string;
  animationClass: string;
  top: string;
  left: string;
  animationDelay: string;
  size: string;
}) => (
  <div
    className={cn(
      'absolute rounded-full opacity-50 dark:opacity-30 mix-blend-multiply dark:mix-blend-lighten filter blur-[40px] sm:blur-3xl md:blur-[300px]',
      animationClass
    )}
    style={{
      backgroundColor: color,
      top,
      left,
      animationDelay,
      width: size,
      height: size,
    }}
  ></div>
);

export const GlobalBackground: React.FC = () => {
  const { isOverlayVisible, getCurrentConfig } = useBackground();
  const currentConfig = getCurrentConfig();

  const renderBackground = () => {
    if (!currentConfig) return null;

    switch (currentConfig.type) {
      case 'blobs':
        return (
          <>
            {currentConfig.blobs.map((blob, index) => {
              const animationClass = animationClasses[blob.animation] || animationClasses.normal;
              return (
                <Blob
                  key={index}
                  color={blob.color}
                  animationClass={animationClass}
                  top={blob.top}
                  left={blob.left}
                  animationDelay={blob.animationDelay}
                  size={blob.size}
                />
              )
            })}
          </>
        );
      case 'gradient':
        const { colors: gradientColors, direction } = currentConfig;
        const gradientStyle = {
          backgroundImage: `linear-gradient(${direction}, ${gradientColors.join(', ')})`,
        };
        return <div className="absolute inset-0" style={gradientStyle}></div>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      {renderBackground()}

      {/* Overlay */}
      {isOverlayVisible && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm"></div>
      )}
    </div>
  );
}; 