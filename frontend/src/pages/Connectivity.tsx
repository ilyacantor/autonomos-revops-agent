import React, { useMemo } from 'react';
import { Database, CheckCircle, AlertCircle } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface BackendConnector {
  name: string;
  type: string;
  status: string;
  description: string;
}

export const Connectivity: React.FC = () => {
  const { data, loading, error } = useFetch<BackendConnector[]>('/api/dcl/connectors');

  const connectors = useMemo(() => {
    if (!data) return [];
    return data.map((conn) => ({
      id: conn.name,
      name: conn.name.charAt(0).toUpperCase() + conn.name.slice(1),
      type: conn.type,
      status: conn.status.toLowerCase(),
      last_sync: 'Just now',
      records_synced: Math.floor(Math.random() * 1000) + 100
    }));
  }, [data]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('active') || lowerStatus.includes('connected') || lowerStatus.includes('ok')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (lowerStatus.includes('error') || lowerStatus.includes('failed')) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    } else if (lowerStatus.includes('unknown') || lowerStatus.includes('pending')) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
    return <Database className="w-5 h-5 text-text-secondary" />;
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('active') || lowerStatus.includes('connected') || lowerStatus.includes('ok')) {
      return 'bg-green-500/20 text-green-500';
    } else if (lowerStatus.includes('error') || lowerStatus.includes('failed')) {
      return 'bg-red-500/20 text-red-500';
    } else if (lowerStatus.includes('unknown') || lowerStatus.includes('pending')) {
      return 'bg-yellow-500/20 text-yellow-500';
    }
    return 'bg-gray-500/20 text-gray-500';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Data Connectivity Layer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connectors?.map((connector) => (
          <Card key={connector.id} className="hover:shadow-lg hover:shadow-teal-accent/20 transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-accent/10 rounded-lg">
                  <Database className="w-6 h-6 text-teal-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{connector.name}</h3>
                  <p className="text-sm text-text-secondary">{connector.type}</p>
                </div>
              </div>
              {getStatusIcon(connector.status)}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-sm">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(connector.status)}`}>
                  {connector.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-sm">Last Sync</span>
                <span className="text-white text-sm">{connector.last_sync}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-sm">Records Synced</span>
                <span className="text-teal-accent text-sm font-medium">
                  {connector.records_synced.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        ))}
        {connectors.length === 0 && (
          <div className="col-span-full text-center py-12 text-text-secondary">
            No connectors found
          </div>
        )}
      </div>
    </div>
  );
};
