import type { ValidationResponse, ValidationRecord, MetricResponse } from '../lib/adapters';

const MOCK_VALIDATIONS: ValidationRecord[] = [
  {
    opportunity_id: '006MOCK001',
    opportunity_name: 'Enterprise Cloud Migration',
    account_name: 'Global Tech Corp',
    stage: 'Negotiation/Review',
    amount: 500000,
    is_valid: true,
    missing_fields: [],
    validation_issues: '',
    risk_level: 'LOW',
  },
  {
    opportunity_id: '006MOCK002',
    opportunity_name: 'Data Platform Upgrade',
    account_name: 'Finance Solutions Inc',
    stage: 'Proposal/Price Quote',
    amount: 250000,
    is_valid: false,
    missing_fields: ['Budget', 'Authority'],
    validation_issues: 'Missing BANT: Budget not confirmed, Decision authority unclear',
    risk_level: 'HIGH',
  },
  {
    opportunity_id: '006MOCK003',
    opportunity_name: 'AI Integration Project',
    account_name: 'Retail Innovations LLC',
    stage: 'Value Proposition',
    amount: 180000,
    is_valid: true,
    missing_fields: [],
    validation_issues: '',
    risk_level: 'LOW',
  },
  {
    opportunity_id: '006MOCK004',
    opportunity_name: 'Security Infrastructure',
    account_name: 'Healthcare Systems Co',
    stage: 'Qualification',
    amount: 420000,
    is_valid: false,
    missing_fields: ['Need', 'Timeline'],
    validation_issues: 'Missing BANT: Business need not validated, Timeline not established',
    risk_level: 'HIGH',
  },
  {
    opportunity_id: '006MOCK005',
    opportunity_name: 'Analytics Dashboard Suite',
    account_name: 'Manufacturing United',
    stage: 'Id. Decision Makers',
    amount: 95000,
    is_valid: true,
    missing_fields: [],
    validation_issues: '',
    risk_level: 'MEDIUM',
  },
  {
    opportunity_id: '006MOCK006',
    opportunity_name: 'Mobile App Development',
    account_name: 'Consumer Brands Group',
    stage: 'Prospecting',
    amount: 75000,
    is_valid: false,
    missing_fields: ['Budget', 'Authority', 'Need'],
    validation_issues: 'Missing BANT: All fields incomplete - early stage opportunity',
    risk_level: 'HIGH',
  },
  {
    opportunity_id: '006MOCK007',
    opportunity_name: 'DevOps Transformation',
    account_name: 'Digital Services Ltd',
    stage: 'Proposal/Price Quote',
    amount: 340000,
    is_valid: true,
    missing_fields: [],
    validation_issues: '',
    risk_level: 'LOW',
  },
  {
    opportunity_id: '006MOCK008',
    opportunity_name: 'Customer Portal Redesign',
    account_name: 'E-commerce Ventures',
    stage: 'Negotiation/Review',
    amount: 125000,
    is_valid: false,
    missing_fields: ['Timeline'],
    validation_issues: 'Missing BANT: Timeline not confirmed',
    risk_level: 'MEDIUM',
  },
];

function calculateMetrics(validations: ValidationRecord[]): MetricResponse[] {
  const total = validations.length;
  const valid = validations.filter((v) => v.is_valid).length;
  const validationRate = total > 0 ? (valid / total) * 100 : 0;
  const highRisk = validations.filter((v) => v.risk_level === 'HIGH').length;

  return [
    { label: 'Total Opportunities', value: String(total) },
    { 
      label: 'Valid Opportunities', 
      value: String(valid), 
      change: `${validationRate.toFixed(1)}%` 
    },
    { 
      label: 'High Risk', 
      value: String(highRisk), 
      change: total > 0 ? `${((highRisk / total) * 100).toFixed(1)}%` : '0%' 
    },
  ];
}

export function getMockCrmIntegrity(): ValidationResponse {
  return {
    metrics: calculateMetrics(MOCK_VALIDATIONS),
    validations: MOCK_VALIDATIONS,
    timestamp: new Date().toISOString(),
  };
}
