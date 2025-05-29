
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { currentEnvironment } from '@/config/environment';

export const EnvironmentIndicator: React.FC = () => {
  // Only show in development environment
  if (currentEnvironment.environment !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50">
      <Badge variant="outline" className="bg-yellow-100 border-yellow-400 text-yellow-800">
        🚧 Development Environment
      </Badge>
    </div>
  );
};
