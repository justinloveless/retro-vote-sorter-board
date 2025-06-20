import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [theme, rawSetTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'light';
  });

  // Load theme from user profile when user is authenticated
  useEffect(() => {
    const loadUserTheme = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('theme_preference')
            .eq('id', user.id)
            .single();

          if (!error && data?.theme_preference) {
            rawSetTheme(data.theme_preference as Theme);
          }
        } catch (error) {
          console.log('No theme preference found, using default');
        }
      }
    };

    loadUserTheme();
  }, [user]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    rawSetTheme(newTheme);

    // Save theme preference to user profile if authenticated
    if (user) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            theme_preference: newTheme
          });
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
