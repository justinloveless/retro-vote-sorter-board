import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { supabase } from '../integrations/supabase/client.ts';

export type BackgroundAnimation = 'static' | 'slow' | 'normal' | 'fast' | 'animate-blob-1' | 'animate-blob-2' | 'animate-blob-3';

export const PRESET_BACKGROUNDS = {
  'blobs-animated': {
    name: 'Animated Blobs',
    type: 'blobs',
    config: {
      light: {
        blobs: [
          { color: '#818cf8', top: '10%', left: '10%', size: '400px', animation: 'normal' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#f472b6', top: '60%', left: '75%', size: '500px', animation: 'normal' as BackgroundAnimation, animationDelay: '2s' },
          { color: '#fbbf24', top: '30%', left: '40%', size: '300px', animation: 'normal' as BackgroundAnimation, animationDelay: '4s' },
        ],
      },
      dark: {
        blobs: [
          { color: '#1e3a8a', top: '10%', left: '10%', size: '400px', animation: 'normal' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#581c87', top: '60%', left: '75%', size: '500px', animation: 'normal' as BackgroundAnimation, animationDelay: '2s' },
          { color: '#eab308', top: '30%', left: '40%', size: '300px', animation: 'normal' as BackgroundAnimation, animationDelay: '4s' },
        ],
      },
    },
  },
  'blobs-static': {
    name: 'Static Blobs',
    type: 'blobs',
    config: {
      light: {
        blobs: [
          { color: '#818cf8', top: '10%', left: '15%', size: '200px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#f472b6', top: '25%', left: '80%', size: '250px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#fbbf24', top: '70%', left: '5%', size: '150px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#818cf8', top: '80%', left: '60%', size: '300px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#f472b6', top: '5%', left: '50%', size: '180px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#fbbf24', top: '50%', left: '45%', size: '220px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#818cf8', top: '90%', left: '90%', size: '180px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#f472b6', top: '95%', left: '25%', size: '220px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#fbbf24', top: '40%', left: '95%', size: '200px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#818cf8', top: '5%', left: '5%', size: '150px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#f472b6', top: '45%', left: '20%', size: '280px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#fbbf24', top: '75%', left: '75%', size: '160px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
        ],
      },
      dark: {
        blobs: [
          { color: '#1e3a8a', top: '10%', left: '15%', size: '200px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#581c87', top: '25%', left: '80%', size: '250px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#eab308', top: '70%', left: '5%', size: '150px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#1e3a8a', top: '80%', left: '60%', size: '300px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#581c87', top: '5%', left: '50%', size: '180px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#eab308', top: '50%', left: '45%', size: '220px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#1e3a8a', top: '90%', left: '90%', size: '180px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#581c87', top: '95%', left: '25%', size: '220px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#eab308', top: '40%', left: '95%', size: '200px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#1e3a8a', top: '5%', left: '5%', size: '150px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#581c87', top: '45%', left: '20%', size: '280px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#eab308', top: '75%', left: '75%', size: '160px', animation: 'static' as BackgroundAnimation, animationDelay: '0s' },
        ],
      },
    },
  },
  'blobs-fast': {
    name: 'Fast Blobs',
    type: 'blobs',
    config: {
      light: {
        blobs: [
          { color: '#22d3ee', top: '5%', left: '50%', size: '400px', animation: 'fast' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#c026d3', top: '80%', left: '10%', size: '550px', animation: 'fast' as BackgroundAnimation, animationDelay: '0.5s' },
          { color: '#eab308', top: '50%', left: '90%', size: '350px', animation: 'fast' as BackgroundAnimation, animationDelay: '1s' },
        ],
      },
      dark: {
        blobs: [
          { color: '#0ea5e9', top: '5%', left: '10%', size: '800px', animation: 'fast' as BackgroundAnimation, animationDelay: '0s' },
          { color: '#be185d', top: '50%', left: '10%', size: '750px', animation: 'fast' as BackgroundAnimation, animationDelay: '0.5s' },
          { color: '#eab308', top: '20%', left: '40%', size: '950px', animation: 'fast' as BackgroundAnimation, animationDelay: '1s' },
        ],
      },
    },
  },
  'gradient': {
    name: 'Gradient',
    type: 'gradient',
    config: {
      light: { colors: ['#a5b4fc', '#f9a8d4'], direction: 'to bottom right' },
      dark: { colors: ['#1e3a8a', '#581c87'], direction: 'to bottom right' },
    },
  },
  'gradient-calm': {
    name: 'Calm Gradient',
    type: 'gradient',
    config: {
      light: { colors: ['#d5deff', '#fce7f3'], direction: 'to top left' },
      dark: { colors: ['#0c194b', '#4a0e4e'], direction: 'to top left' },
    },
  },
} as const;

export type PresetKey = keyof typeof PRESET_BACKGROUNDS;

export type BackgroundPreference = {
  preset: PresetKey;
};

const defaultPreference: BackgroundPreference = { preset: 'blobs-animated' };

interface BackgroundContextType {
  isOverlayVisible: boolean;
  setOverlayVisible: (visible: boolean) => void;
  preference: BackgroundPreference;
  updatePreference: (newPreference: BackgroundPreference) => Promise<void>;
  getCurrentConfig: () => { type: 'blobs'; blobs: readonly { color: string; top: string; left: string; animationDelay: string; size: string; animation: BackgroundAnimation; }[]; } | { type: 'gradient'; direction: string; colors: readonly string[]; };
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [isOverlayVisible, setOverlayVisible] = useState(false);
  const [preference, setPreference] = useState<BackgroundPreference>(defaultPreference);

  useEffect(() => {
    if (profile?.background_preference && (profile.background_preference as any).preset) {
      setPreference(profile.background_preference as BackgroundPreference);
    } else if (user) {
      // User is authenticated but no preference set
      setPreference(defaultPreference);
    } else {
      // Anonymous user
      setPreference(defaultPreference);
    }
  }, [profile, user]);

  const updatePreference = async (newPreference: BackgroundPreference) => {
    setPreference(newPreference);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            background_preference: newPreference,
          });
      } catch (error) {
        console.error('Error saving background preference:', error);
      }
    }
  };

  const getCurrentConfig = () => {
    const preset = PRESET_BACKGROUNDS[preference.preset];

    if (preset.type === 'blobs') {
      const themeConfig = preset.config[theme];
      return {
        type: 'blobs' as const,
        blobs: themeConfig.blobs,
      };
    } else if (preset.type === 'gradient') {
      const themeConfig = preset.config[theme];
      return {
        type: 'gradient' as const,
        direction: themeConfig.direction,
        colors: themeConfig.colors,
      };
    }
    throw new Error('Invalid preset type');
  };

  const value = useMemo(() => ({
    isOverlayVisible,
    setOverlayVisible,
    preference,
    updatePreference,
    getCurrentConfig,
  }), [isOverlayVisible, preference, theme]); // theme must be a dependency

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
}; 