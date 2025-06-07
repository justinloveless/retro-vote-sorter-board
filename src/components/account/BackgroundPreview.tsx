import React from 'react';
import { cn } from '@/lib/utils';
import { PRESET_BACKGROUNDS, PresetKey, BackgroundAnimation } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';

interface BackgroundPreviewProps {
    presetKey: PresetKey;
}

const animationClasses: Record<string, string> = {
    static: 'animate-none',
    slow: 'animate-blob-slow',
    normal: 'animate-blob-2',
    fast: 'animate-blob-1',
    'animate-blob-1': 'animate-blob-1',
    'animate-blob-2': 'animate-blob-2',
    'animate-blob-3': 'animate-blob-3',
};

export const BackgroundPreview: React.FC<BackgroundPreviewProps> = ({ presetKey }) => {
    const { theme } = useTheme();
    const preset = PRESET_BACKGROUNDS[presetKey];

    const renderPreview = () => {
        if (preset.type === 'blobs') {
            const themeConfig = preset.config[theme];
            return (
                <>
                    {themeConfig.blobs.map((blob, index) => {
                        const animationClass = animationClasses[blob.animation] ?? 'animate-blob-2';
                        return (
                            <div
                                key={index}
                                className={cn("absolute rounded-full filter blur-lg", animationClass)}
                                style={{
                                    width: `calc(${blob.size} / 5)`,
                                    height: `calc(${blob.size} / 5)`,
                                    backgroundColor: blob.color,
                                    top: blob.top,
                                    left: blob.left,
                                    animationDelay: blob.animationDelay,
                                }}
                            ></div>
                        );
                    })}
                </>
            );
        }

        if (preset.type === 'gradient') {
            const themeConfig = preset.config[theme];
            const gradientStyle = {
                backgroundImage: `linear-gradient(${themeConfig.direction}, ${themeConfig.colors.join(', ')})`,
            };
            return <div className="absolute inset-0" style={gradientStyle}></div>;
        }

        return null;
    };

    return (
        <div className="relative w-16 h-10 rounded-md overflow-hidden border border-border">
            <div className="absolute inset-0 bg-background"></div>
            {renderPreview()}
        </div>
    );
}; 