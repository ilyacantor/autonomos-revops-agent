import { useState, useEffect } from 'react';
import { getAosClient } from '../lib/aosClient';
import { X, Code } from 'lucide-react';

const isDevelopment = import.meta.env.DEV;

export function DebugTracePanel() {
  const [traceId, setTraceId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isDevelopment) return;

    const interval = setInterval(() => {
      const client = getAosClient();
      const latestTraceId = client?.getLastTraceId() || null;
      if (latestTraceId !== traceId) {
        setTraceId(latestTraceId);
        if (latestTraceId) {
          setIsVisible(true);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [traceId]);

  if (!isDevelopment || !traceId || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card-bg border border-teal-accent rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Code className="w-5 h-5 text-teal-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-1">
                Platform Trace ID
              </div>
              <div className="text-xs text-text-secondary break-all font-mono bg-black/30 px-2 py-1 rounded">
                {traceId}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-text-secondary hover:text-white transition flex-shrink-0"
            aria-label="Close trace panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-xs text-text-secondary">
          Development mode only - for debugging platform requests
        </div>
      </div>
    </div>
  );
}
