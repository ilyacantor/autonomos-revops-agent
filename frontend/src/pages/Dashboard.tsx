import React, { useMemo } from 'react';
import { Play } from 'lucide-react';
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

interface OpportunityRecord {
  id: string;
  name: string;
  account_name: string;
  stage: string;
  amount: number;
  health_score: number;
  risk_score: number;
  is_stalled: boolean;
}

interface BackendResponse {
  metrics: MetricResponse[];
  opportunities: OpportunityRecord[];
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const { data, loading, error, refetch } = useFetch<BackendResponse>('/api/workflows/pipeline-health', { method: 'POST' });

  const parsedMetrics = useMemo(() => {
    if (!data?.metrics) return null;
    
    const metrics: Record<string, { value: string; change?: string; trend?: string }> = {};
    data.metrics.forEach(m => {
      const key = m.label.toLowerCase().replace(/\s+/g, '_');
      metrics[key] = { value: m.value, change: m.change, trend: m.trend };
    });
    
    return metrics;
  }, [data?.metrics]);

  const handleRunWorkflow = () => {
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Error: {error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-teal-accent text-white rounded hover:bg-teal-hover transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Pipeline Health Dashboard</h1>
        <button
          onClick={handleRunWorkflow}
          className="flex items-center gap-2 px-6 py-3 bg-teal-accent text-white rounded-lg hover:bg-teal-hover hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-200"
        >
          <Play className="w-5 h-5" />
          Run Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          label="Total Opportunities"
          value={parsedMetrics?.total_opportunities?.value || '0'}
          trend={parsedMetrics?.total_opportunities?.trend as any}
        />
        <MetricCard
          label="At Risk"
          value={parsedMetrics?.at_risk?.value || '0'}
          change={parsedMetrics?.at_risk?.change}
        />
        <MetricCard
          label="Healthy"
          value={parsedMetrics?.healthy?.value || '0'}
          change={parsedMetrics?.healthy?.change}
        />
        <MetricCard
          label="Pipeline Value"
          value={parsedMetrics?.pipeline_value?.value || '$0'}
        />
        <MetricCard
          label="Stalled Deals"
          value={parsedMetrics?.stalled_deals?.value || '0'}
        />
        <MetricCard
          label="Avg Health Score"
          value={parsedMetrics?.avg_health_score?.value || '0'}
        />
      </div>

      <Card>
        <h2 className="text-xl font-bold text-white mb-4">Top Opportunities</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Account</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Stage</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Amount</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Health Score</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {data?.opportunities?.map((opp) => (
                <tr key={opp.id} className="border-b border-card-border/50 hover:bg-card-border/20 transition">
                  <td className="py-3 px-4 text-white">{opp.name}</td>
                  <td className="py-3 px-4 text-text-secondary">{opp.account_name}</td>
                  <td className="py-3 px-4 text-text-secondary">{opp.stage}</td>
                  <td className="py-3 px-4 text-right text-white">${opp.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${opp.health_score >= 70 ? 'text-green-500' : opp.health_score >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {opp.health_score}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${opp.risk_score >= 70 ? 'text-red-500' : opp.risk_score >= 40 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {opp.risk_score}
                    </span>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-secondary">
                    No opportunities found
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
