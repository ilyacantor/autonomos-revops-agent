import type { BackendResponse, OpportunityRecord, MetricResponse } from '../lib/adapters';

const MOCK_OPPORTUNITIES: OpportunityRecord[] = [
  {
    id: '006MOCK001',
    name: 'Enterprise Cloud Migration',
    account_name: 'Global Tech Corp',
    stage: 'Negotiation/Review',
    amount: 500000,
    health_score: 85,
    risk_score: 45,
    is_stalled: false,
    last_login_days: 2,
    sessions_30d: 45,
  },
  {
    id: '006MOCK002',
    name: 'Data Platform Upgrade',
    account_name: 'Finance Solutions Inc',
    stage: 'Proposal/Price Quote',
    amount: 250000,
    health_score: 72,
    risk_score: 65,
    is_stalled: true,
    last_login_days: 15,
    sessions_30d: 12,
  },
  {
    id: '006MOCK003',
    name: 'AI Integration Project',
    account_name: 'Retail Innovations LLC',
    stage: 'Value Proposition',
    amount: 180000,
    health_score: 90,
    risk_score: 30,
    is_stalled: false,
    last_login_days: 1,
    sessions_30d: 67,
  },
  {
    id: '006MOCK004',
    name: 'Security Infrastructure',
    account_name: 'Healthcare Systems Co',
    stage: 'Qualification',
    amount: 420000,
    health_score: 55,
    risk_score: 80,
    is_stalled: true,
    last_login_days: 30,
    sessions_30d: 5,
  },
  {
    id: '006MOCK005',
    name: 'Analytics Dashboard Suite',
    account_name: 'Manufacturing United',
    stage: 'Id. Decision Makers',
    amount: 95000,
    health_score: 78,
    risk_score: 50,
    is_stalled: false,
    last_login_days: 7,
    sessions_30d: 25,
  },
  {
    id: '006MOCK006',
    name: 'Mobile App Development',
    account_name: 'Consumer Brands Group',
    stage: 'Prospecting',
    amount: 75000,
    health_score: 45,
    risk_score: 95,
    is_stalled: true,
    last_login_days: 45,
    sessions_30d: 2,
  },
  {
    id: '006MOCK007',
    name: 'DevOps Transformation',
    account_name: 'Digital Services Ltd',
    stage: 'Proposal/Price Quote',
    amount: 340000,
    health_score: 82,
    risk_score: 35,
    is_stalled: false,
    last_login_days: 3,
    sessions_30d: 52,
  },
  {
    id: '006MOCK008',
    name: 'Customer Portal Redesign',
    account_name: 'E-commerce Ventures',
    stage: 'Negotiation/Review',
    amount: 125000,
    health_score: 68,
    risk_score: 70,
    is_stalled: true,
    last_login_days: 20,
    sessions_30d: 8,
  },
];

function calculateMetrics(opportunities: OpportunityRecord[]): MetricResponse[] {
  const total = opportunities.length;
  const atRisk = opportunities.filter((o) => o.risk_score >= 70).length;
  const stalled = opportunities.filter((o) => o.is_stalled).length;
  const healthy = opportunities.filter((o) => o.risk_score < 70 && !o.is_stalled).length;
  const totalValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
  const avgHealth = total > 0 
    ? Math.round(opportunities.reduce((sum, o) => sum + o.health_score, 0) / total)
    : 0;
  const avgRisk = total > 0
    ? Math.round(opportunities.reduce((sum, o) => sum + o.risk_score, 0) / total)
    : 0;
  const highRisk = opportunities.filter((o) => o.risk_score >= 70).length;

  return [
    { label: 'Total Opportunities', value: String(total), trend: 'up' },
    { 
      label: 'At Risk', 
      value: String(atRisk), 
      change: total > 0 ? `${((atRisk / total) * 100).toFixed(1)}%` : '0%' 
    },
    { 
      label: 'Healthy', 
      value: String(healthy), 
      change: total > 0 ? `${((healthy / total) * 100).toFixed(1)}%` : '0%' 
    },
    { label: 'Stalled Deals', value: String(stalled) },
    { label: 'Pipeline Value', value: `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: 'Avg Health Score', value: String(avgHealth) },
    { label: 'High Risk Deals', value: String(highRisk) },
    { label: 'Avg Risk Score', value: String(avgRisk) },
  ];
}

export function getMockPipelineHealth(): BackendResponse {
  return {
    metrics: calculateMetrics(MOCK_OPPORTUNITIES),
    opportunities: MOCK_OPPORTUNITIES,
    data_quality: {
      health_data_available: true,
      usage_data_available: true,
      warnings: [],
    },
    timestamp: new Date().toISOString(),
  };
}
