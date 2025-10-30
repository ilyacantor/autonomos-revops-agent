import React, { useState, useMemo } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { MetricCard } from '@/components/MetricCard';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface MetricResponse {
  label: string;
  value: string;
  change?: string;
  trend?: string;
}

interface ValidationRecord {
  opportunity_id: string;
  opportunity_name: string;
  account_name: string;
  stage: string;
  amount: number;
  is_valid: boolean;
  missing_fields: string[];
  validation_issues: string;
}

interface BackendResponse {
  metrics: MetricResponse[];
  validations: ValidationRecord[];
  timestamp: string;
}

export const Operations: React.FC = () => {
  const { data, loading, error } = useFetch<BackendResponse>('/api/workflows/crm-integrity', { method: 'POST' });
  const [selectedStage, setSelectedStage] = useState<string>('all');

  const parsedMetrics = useMemo(() => {
    if (!data?.metrics) return null;
    
    const metrics: Record<string, { value: string; change?: string }> = {};
    data.metrics.forEach(m => {
      const key = m.label.toLowerCase().replace(/\s+/g, '_');
      metrics[key] = { value: m.value, change: m.change };
    });
    
    return metrics;
  }, [data?.metrics]);

  const stages = useMemo(() => {
    if (!data?.validations) return [];
    const uniqueStages = new Set(data.validations.map(v => v.stage));
    return Array.from(uniqueStages).filter(Boolean);
  }, [data?.validations]);

  const transformedValidations = useMemo(() => {
    if (!data?.validations) return [];
    return data.validations.map(v => ({
      id: v.opportunity_id,
      record_name: v.opportunity_name,
      stage: v.stage,
      status: v.is_valid ? 'valid' as const : 'invalid' as const,
      issues: v.is_valid ? [] : [...v.missing_fields, v.validation_issues].filter(Boolean)
    }));
  }, [data?.validations]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  const filteredValidations = selectedStage === 'all'
    ? transformedValidations
    : transformedValidations?.filter((v) => v.stage === selectedStage);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">CRM Integrity Operations</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          label="Total Records"
          value={parsedMetrics?.total_records?.value || '0'}
        />
        <MetricCard
          label="Valid"
          value={parsedMetrics?.valid?.value || '0'}
          change={parsedMetrics?.valid?.change}
        />
        <MetricCard
          label="Invalid"
          value={parsedMetrics?.invalid?.value || '0'}
          change={parsedMetrics?.invalid?.change}
        />
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Validation Results</h2>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-4 py-2 bg-dark-bg border border-card-border rounded text-white focus:outline-none focus:border-teal-accent"
          >
            <option value="all">All Stages</option>
            {stages?.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Record Name</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Stage</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {filteredValidations?.map((validation) => (
                <tr key={validation.id} className="border-b border-card-border/50 hover:bg-card-border/20 transition">
                  <td className="py-3 px-4 text-white">{validation.record_name}</td>
                  <td className="py-3 px-4 text-text-secondary">{validation.stage}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        validation.status === 'valid'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {validation.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {validation.issues.length > 0 ? validation.issues.join(', ') : 'None'}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    No validation records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
