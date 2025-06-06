import React, { createContext, useState, useContext, useMemo } from 'react';

interface BackgroundContextType {
  isOverlayVisible: boolean;
  setOverlayVisible: (visible: boolean) => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOverlayVisible, setOverlayVisible] = useState(false);

  const value = useMemo(() => ({
    isOverlayVisible,
    setOverlayVisible,
  }), [isOverlayVisible]);

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