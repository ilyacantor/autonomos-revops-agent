import React, { useMemo, useState } from 'react';
import { Play, AlertTriangle, Send, X, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePaginatedFetch } from '@/hooks/usePaginatedFetch';
import { MetricCard } from '@/components/MetricCard';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fetchPipelineHealthWithFallback } from '../lib/dataFetchers';
import { sendPipelineAlert } from '../lib/intentHelpers';
import type { BackendResponse } from '../lib/adapters';

export const Dashboard: React.FC = () => {
  const { 
    data, 
    loading, 
    error, 
    page, 
    pageSize, 
    totalPages, 
    hasMore, 
    nextPage, 
    prevPage, 
    goToPage, 
    setPageSize, 
    refetch 
  } = usePaginatedFetch<BackendResponse>(
    fetchPipelineHealthWithFallback,
    50
  );
  
  const [showStalledOnly, setShowStalledOnly] = useState(false);
  const [riskScoreFilter, setRiskScoreFilter] = useState(0);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const parsedMetrics = useMemo(() => {
    if (!data?.metrics) return null;
    
    const metrics: Record<string, { value: string; change?: string; trend?: string }> = {};
    data.metrics.forEach(m => {
      const key = m.label.toLowerCase().replace(/\s+/g, '_');
      metrics[key] = { value: m.value, change: m.change, trend: m.trend };
    });
    
    return metrics;
  }, [data?.metrics]);

  const highRiskDeals = useMemo(() => {
    if (!data?.opportunities) return 0;
    return data.opportunities.filter(opp => opp.risk_score > 70).length;
  }, [data?.opportunities]);

  const avgRiskScore = useMemo(() => {
    if (!data?.opportunities || data.opportunities.length === 0) return 0;
    const sum = data.opportunities.reduce((acc, opp) => acc + opp.risk_score, 0);
    return Math.round(sum / data.opportunities.length);
  }, [data?.opportunities]);

  const filteredOpportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    
    return data.opportunities.filter(opp => {
      if (showStalledOnly && !opp.is_stalled) return false;
      if (opp.risk_score < riskScoreFilter) return false;
      return true;
    });
  }, [data?.opportunities, showStalledOnly, riskScoreFilter]);

  const scatterData = useMemo(() => {
    if (!data?.opportunities) return [];
    
    return data.opportunities.map(opp => ({
      x: opp.health_score,
      y: opp.risk_score,
      z: opp.amount / 10000,
      name: opp.name,
      stage: opp.stage,
      amount: opp.amount,
      isStalled: opp.is_stalled,
    }));
  }, [data?.opportunities]);

  const histogramData = useMemo(() => {
    if (!data?.opportunities) return [];
    
    const bins = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '20-40', min: 20, max: 40, count: 0 },
      { range: '40-60', min: 40, max: 60, count: 0 },
      { range: '60-80', min: 60, max: 80, count: 0 },
      { range: '80-100', min: 80, max: 100, count: 0 },
    ];
    
    data.opportunities.forEach(opp => {
      const bin = bins.find(b => opp.risk_score >= b.min && opp.risk_score <= b.max);
      if (bin) bin.count++;
    });
    
    return bins;
  }, [data?.opportunities]);

  const highRiskDealIds = useMemo(() => {
    if (!data?.opportunities) return [];
    return data.opportunities
      .filter(opp => opp.risk_score > 70)
      .map(opp => opp.id);
  }, [data?.opportunities]);

  const handleRunWorkflow = () => {
    refetch();
  };

  const handleSendAlerts = async () => {
    setAlertLoading(true);
    setAlertMessage(null);
    
    try {
      const result = await sendPipelineAlert(highRiskDealIds, false);
      
      if (result.success) {
        setAlertMessage({ type: 'success', text: result.message });
      } else {
        setAlertMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: 'Failed to send alerts. Please try again.' });
    } finally {
      setAlertLoading(false);
      setTimeout(() => setAlertMessage(null), 5000);
    }
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

      {data?.data_quality?.warnings && data.data_quality.warnings.length > 0 && !warningDismissed && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-400 font-semibold mb-2">Data Quality Issues</h3>
            <ul className="text-amber-400/90 text-sm space-y-1">
              {data.data_quality.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setWarningDismissed(true)}
            className="text-amber-400 hover:text-amber-300 transition p-1"
            aria-label="Dismiss warning"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Opportunities"
          value={parsedMetrics?.total_opportunities?.value || '0'}
          trend={parsedMetrics?.total_opportunities?.trend as any}
        />
        <MetricCard
          label="At Risk"
          value={parsedMetrics?.at_risk?.value || '0'}
          change={parsedMetrics?.at_risk?.change}
          infoTooltip={data?.data_quality?.usage_data_available === false ? 'Usage data unavailable - risk calculations may be incomplete' : undefined}
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
          infoTooltip={data?.data_quality?.health_data_available === false ? 'Health data unavailable - showing mock/default values' : undefined}
        />
        <MetricCard
          label="High Risk Deals"
          value={highRiskDeals.toString()}
          change={data?.opportunities ? `${((highRiskDeals / data.opportunities.length) * 100).toFixed(1)}%` : '0%'}
          infoTooltip={data?.data_quality?.usage_data_available === false ? 'Usage data unavailable - risk calculations may be incomplete' : undefined}
        />
        <MetricCard
          label="Avg Risk Score"
          value={avgRiskScore.toString()}
          infoTooltip={data?.data_quality?.usage_data_available === false ? 'Usage data unavailable - risk calculations may be incomplete' : undefined}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Risk Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Health Score vs Risk Score</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Health Score"
                  domain={[0, 100]}
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8' }}
                  label={{ value: 'Health Score', position: 'insideBottom', offset: -10, fill: '#94A3B8' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Risk Score"
                  domain={[0, 100]}
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8' }}
                  label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0A2540] border border-card-border rounded-lg p-3 shadow-lg">
                          <p className="text-white font-semibold">{data.name}</p>
                          <p className="text-text-secondary text-sm">{data.stage}</p>
                          <p className="text-white text-sm mt-1">Amount: ${data.amount.toLocaleString()}</p>
                          <p className="text-green-500 text-sm">Health: {data.x}</p>
                          <p className="text-red-500 text-sm">Risk: {data.y}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={scatterData} fill="#8884d8">
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isStalled ? '#FF6B6B' : '#10B981'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Risk Score Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogramData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis
                  dataKey="range"
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8' }}
                  label={{ value: 'Risk Score Range', position: 'insideBottom', offset: -10, fill: '#94A3B8' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8' }}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                  contentStyle={{ backgroundColor: '#0A2540', border: '1px solid #1E3A5F', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#FF6B6B' }}
                />
                <Bar dataKey="count" fill="#FF6B6B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {highRiskDeals > 0 && (
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">High-Risk Deals Detected</h3>
                <p className="text-text-secondary">
                  {highRiskDeals} {highRiskDeals === 1 ? 'deal has' : 'deals have'} a risk score above 70 and require immediate attention.
                </p>
              </div>
            </div>
            <button
              onClick={handleSendAlerts}
              disabled={alertLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {alertLoading ? 'Sending...' : 'Send Slack Alerts'}
            </button>
          </div>
          {alertMessage && (
            <div className={`mt-4 p-3 rounded-lg ${alertMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {alertMessage.text}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-4">Filters</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={showStalledOnly}
                onChange={(e) => setShowStalledOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-card-bg text-teal-accent focus:ring-teal-accent focus:ring-offset-0"
              />
              <span>Show stalled deals only</span>
            </label>
            
            <div className="flex items-center gap-3 flex-1">
              <label className="text-white whitespace-nowrap">Min Risk Score:</label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={riskScoreFilter}
                onChange={(e) => setRiskScoreFilter(Number(e.target.value))}
                className="flex-1 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-teal-accent"
              />
              <span className="text-white font-medium w-8 text-right">{riskScoreFilter}</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm mt-2">
            Showing {filteredOpportunities.length} of {data?.opportunities?.length || 0} opportunities
          </p>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">Opportunities</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Account</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Stage</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Amount</th>
                <th className="text-center py-3 px-4 text-text-secondary font-medium">Status</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Health Score</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.length > 0 ? (
                filteredOpportunities.map((opp) => (
                  <tr key={opp.id} className="border-b border-card-border/50 hover:bg-card-border/20 transition">
                    <td className="py-3 px-4 text-white">{opp.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{opp.account_name}</td>
                    <td className="py-3 px-4 text-text-secondary">{opp.stage}</td>
                    <td className="py-3 px-4 text-right text-white">${opp.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        opp.is_stalled 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {opp.is_stalled ? 'Stalled' : 'Active'}
                      </span>
                    </td>
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    No opportunities match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && (
          <div className="mt-6 flex items-center justify-between border-t border-card-border pt-4">
            <div className="flex items-center gap-4">
              <div className="text-text-secondary text-sm">
                Page {page} of {totalPages} ({data.pagination.total} total records)
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-text-secondary text-sm">Per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-card-bg border border-card-border rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-accent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-card-bg border border-card-border rounded text-white text-sm hover:bg-card-border transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        page === pageNum
                          ? 'bg-teal-accent text-white font-medium'
                          : 'bg-card-bg border border-card-border text-white hover:bg-card-border'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={nextPage}
                disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-1.5 bg-card-bg border border-card-border rounded text-white text-sm hover:bg-card-border transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
