import React, { useState, useEffect } from 'react';
import { getHeaderOverrides, getCSharpApiHeaders, HeaderOverrides } from '@/config/environment';

export const HeaderDebugInfo: React.FC = () => {
  const [overrides, setOverrides] = useState<HeaderOverrides>({});
  const [headers, setHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateInfo = () => {
      setOverrides(getHeaderOverrides());
      setHeaders(getCSharpApiHeaders());
    };

    updateInfo();

    // Update every second to show real-time changes
    const interval = setInterval(updateInfo, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 10000,
        maxWidth: '300px',
      }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Header Debug Info</h4>

      <div style={{ marginBottom: '8px' }}>
        <strong>Overrides:</strong>
        <pre
          style={{
            margin: '4px 0',
            fontSize: '10px',
            background: 'rgba(255,255,255,0.1)',
            padding: '4px',
            borderRadius: '4px',
          }}>
          {JSON.stringify(overrides, null, 2)}
        </pre>
      </div>

      <div>
        <strong>Headers:</strong>
        <pre
          style={{
            margin: '4px 0',
            fontSize: '10px',
            background: 'rgba(255,255,255,0.1)',
            padding: '4px',
            borderRadius: '4px',
          }}>
          {JSON.stringify(headers, null, 2)}
        </pre>
      </div>

      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '8px' }}>
        This component shows the current header state. Use the Debug API Toggle to modify headers.
      </div>
    </div>
  );
};
