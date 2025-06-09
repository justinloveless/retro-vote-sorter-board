import React from 'react';

export const BoardNotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">Board Not Found</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          This retro board has been deleted or you don't have access.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          If you believe this is an error, please contact your team administrator.
        </p>
      </div>
    </div>
  );
}; 