import { describe, it, expect } from 'vitest';
import {
  adaptOpportunitiesResponse,
  adaptValidationsResponse,
  adaptOpportunitiesView,
  adaptAccountsView,
  calculateMetricsFromOpportunities,
  calculateMetricsFromValidations,
  type PlatformViewResponse,
  type PlatformOpportunity,
  type PlatformAccount,
} from '../adapters';

describe('adaptOpportunitiesResponse', () => {
  it('should transform platform opportunities to BackendResponse', () => {
    const mockPlatformResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-1',
          name: 'Enterprise Deal',
          accountName: 'Acme Corp',
          stage: 'Negotiation',
          amount: 100000,
          healthScore: 85,
          riskScore: 25,
          isStalled: false,
          lastLoginDays: 3,
          sessions30d: 45,
        },
        {
          id: 'opp-2',
          name: 'Small Business Deal',
          account_name: 'TechStart Inc',
          stage: 'Proposal',
          amount: 25000,
          health_score: 60,
          risk_score: 75,
          is_stalled: true,
          last_login_days: 15,
          sessions_30d: 5,
        },
      ],
      total: 2,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(mockPlatformResponse);

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('opportunities');
    expect(result).toHaveProperty('data_quality');
    expect(result).toHaveProperty('timestamp');
    
    expect(result.opportunities).toHaveLength(2);
    expect(result.opportunities[0]).toEqual({
      id: 'opp-1',
      name: 'Enterprise Deal',
      account_name: 'Acme Corp',
      stage: 'Negotiation',
      amount: 100000,
      health_score: 85,
      risk_score: 25,
      is_stalled: false,
      last_login_days: 3,
      sessions_30d: 45,
    });
    
    expect(result.data_quality.health_data_available).toBe(true);
    expect(result.data_quality.usage_data_available).toBe(true);
    expect(result.data_quality.warnings).toEqual([]);
  });

  it('should handle missing optional fields with defaults', () => {
    const mockPlatformResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-minimal',
          name: 'Minimal Deal',
          stage: 'Discovery',
          amount: 50000,
        } as PlatformOpportunity,
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(mockPlatformResponse);

    expect(result.opportunities[0]).toEqual({
      id: 'opp-minimal',
      name: 'Minimal Deal',
      account_name: 'Unknown',
      stage: 'Discovery',
      amount: 50000,
      health_score: 0,
      risk_score: 0,
      is_stalled: false,
      last_login_days: null,
      sessions_30d: null,
    });
  });

  it('should normalize camelCase to snake_case fields', () => {
    const camelCaseResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-camel',
          name: 'CamelCase Deal',
          accountName: 'Camel Corp',
          stage: 'Closed Won',
          stageName: 'Closed Won',
          amount: 75000,
          healthScore: 90,
          riskScore: 10,
          isStalled: false,
          lastLoginDays: 1,
          sessions30d: 100,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const snakeCaseResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-snake',
          name: 'snake_case Deal',
          account_name: 'Snake Corp',
          stage: 'Closed Won',
          amount: 75000,
          health_score: 90,
          risk_score: 10,
          is_stalled: false,
          last_login_days: 1,
          sessions_30d: 100,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const camelResult = adaptOpportunitiesResponse(camelCaseResponse);
    const snakeResult = adaptOpportunitiesResponse(snakeCaseResponse);

    expect(camelResult.opportunities[0].account_name).toBe('Camel Corp');
    expect(camelResult.opportunities[0].stage).toBe('Closed Won');
    expect(camelResult.opportunities[0].health_score).toBe(90);
    expect(camelResult.opportunities[0].risk_score).toBe(10);
    expect(camelResult.opportunities[0].is_stalled).toBe(false);
    expect(camelResult.opportunities[0].last_login_days).toBe(1);
    expect(camelResult.opportunities[0].sessions_30d).toBe(100);

    expect(snakeResult.opportunities[0].account_name).toBe('Snake Corp');
    expect(snakeResult.opportunities[0].stage).toBe('Closed Won');
  });

  it('should calculate is_stalled correctly', () => {
    const stalledResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-stalled-1',
          name: 'Stalled Deal 1',
          stage: 'Proposal',
          amount: 30000,
          isStalled: true,
        } as PlatformOpportunity,
        {
          id: 'opp-stalled-2',
          name: 'Stalled Deal 2',
          stage: 'Negotiation',
          amount: 40000,
          is_stalled: true,
        } as PlatformOpportunity,
        {
          id: 'opp-active',
          name: 'Active Deal',
          stage: 'Discovery',
          amount: 20000,
          isStalled: false,
        } as PlatformOpportunity,
      ],
      total: 3,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(stalledResponse);

    expect(result.opportunities[0].is_stalled).toBe(true);
    expect(result.opportunities[1].is_stalled).toBe(true);
    expect(result.opportunities[2].is_stalled).toBe(false);

    const stalledMetric = result.metrics.find(m => m.label === 'Stalled Deals');
    expect(stalledMetric?.value).toBe('2');
  });

  it('should handle empty opportunities array', () => {
    const emptyResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [],
      total: 0,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(emptyResponse);

    expect(result.opportunities).toHaveLength(0);
    expect(result.metrics).toBeDefined();
    
    const totalMetric = result.metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('0');
    
    const atRiskMetric = result.metrics.find(m => m.label === 'At Risk');
    expect(atRiskMetric?.value).toBe('0');
    expect(atRiskMetric?.change).toBe('0%');
    
    const pipelineMetric = result.metrics.find(m => m.label === 'Pipeline Value');
    expect(pipelineMetric?.value).toBe('$0');
  });

  it('should preserve pagination metadata', () => {
    const paginatedResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-page-1',
          name: 'Deal Page 1',
          stage: 'Discovery',
          amount: 10000,
        } as PlatformOpportunity,
      ],
      total: 100,
      page: 2,
      page_size: 25,
      metadata: {
        has_more: true,
        next_cursor: 'cursor-abc123',
      },
    };

    const result = adaptOpportunitiesResponse(paginatedResponse);

    expect(result.opportunities).toHaveLength(1);
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should calculate metrics correctly for mixed opportunities', () => {
    const mixedResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-1',
          name: 'Healthy Deal',
          stage: 'Proposal',
          amount: 100000,
          healthScore: 85,
          riskScore: 20,
          isStalled: false,
        } as PlatformOpportunity,
        {
          id: 'opp-2',
          name: 'At Risk Deal',
          stage: 'Negotiation',
          amount: 50000,
          healthScore: 40,
          riskScore: 80,
          isStalled: false,
        } as PlatformOpportunity,
        {
          id: 'opp-3',
          name: 'Stalled Deal',
          stage: 'Discovery',
          amount: 30000,
          healthScore: 50,
          riskScore: 60,
          isStalled: true,
        } as PlatformOpportunity,
      ],
      total: 3,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(mixedResponse);

    const totalMetric = result.metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('3');

    const atRiskMetric = result.metrics.find(m => m.label === 'At Risk');
    expect(atRiskMetric?.value).toBe('1');
    expect(atRiskMetric?.change).toBe('33.3%');

    const stalledMetric = result.metrics.find(m => m.label === 'Stalled Deals');
    expect(stalledMetric?.value).toBe('1');

    const healthyMetric = result.metrics.find(m => m.label === 'Healthy');
    expect(healthyMetric?.value).toBe('1');

    const pipelineMetric = result.metrics.find(m => m.label === 'Pipeline Value');
    expect(pipelineMetric?.value).toBe('$180,000');

    const avgHealthMetric = result.metrics.find(m => m.label === 'Avg Health Score');
    expect(avgHealthMetric?.value).toBe('58');

    const highRiskMetric = result.metrics.find(m => m.label === 'High Risk Deals');
    expect(highRiskMetric?.value).toBe('1');
  });

  it('should handle null values in optional fields', () => {
    const nullResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-null',
          name: 'Deal with Nulls',
          stage: 'Proposal',
          amount: 60000,
          lastLoginDays: null,
          sessions30d: null,
        } as PlatformOpportunity,
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesResponse(nullResponse);

    expect(result.opportunities[0].last_login_days).toBeNull();
    expect(result.opportunities[0].sessions_30d).toBeNull();
  });
});

describe('adaptValidationsResponse', () => {
  it('should transform platform accounts to ValidationResponse', () => {
    const mockPlatformResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-1',
          opportunityName: 'Valid Deal',
          accountName: 'Valid Corp',
          stage: 'Proposal',
          amount: 100000,
          isValid: true,
          missingFields: [],
          validationIssues: '',
          riskLevel: 'LOW',
        },
        {
          opportunity_id: 'opp-2',
          opportunity_name: 'Invalid Deal',
          account_name: 'Invalid Inc',
          stage: 'Discovery',
          amount: 50000,
          is_valid: false,
          missing_fields: ['close_date', 'contact_info'],
          validation_issues: 'Missing critical fields',
          risk_level: 'HIGH',
        },
      ],
      total: 2,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(mockPlatformResponse);

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('validations');
    expect(result).toHaveProperty('timestamp');
    
    expect(result.validations).toHaveLength(2);
    expect(result.validations[0]).toEqual({
      opportunity_id: 'opp-1',
      opportunity_name: 'Valid Deal',
      account_name: 'Valid Corp',
      stage: 'Proposal',
      amount: 100000,
      is_valid: true,
      missing_fields: [],
      validation_issues: '',
      risk_level: 'LOW',
    });
  });

  it('should calculate validation metrics correctly', () => {
    const mockPlatformResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-1',
          opportunityName: 'Valid Deal 1',
          stage: 'Proposal',
          amount: 100000,
          isValid: true,
          riskLevel: 'LOW',
        } as PlatformAccount,
        {
          opportunityId: 'opp-2',
          opportunityName: 'Valid Deal 2',
          stage: 'Negotiation',
          amount: 75000,
          isValid: true,
          riskLevel: 'MEDIUM',
        } as PlatformAccount,
        {
          opportunityId: 'opp-3',
          opportunityName: 'Invalid Deal',
          stage: 'Discovery',
          amount: 50000,
          isValid: false,
          riskLevel: 'HIGH',
        } as PlatformAccount,
        {
          opportunityId: 'opp-4',
          opportunityName: 'High Risk Deal',
          stage: 'Proposal',
          amount: 60000,
          isValid: true,
          riskLevel: 'HIGH',
        } as PlatformAccount,
      ],
      total: 4,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(mockPlatformResponse);

    const totalMetric = result.metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('4');

    const validMetric = result.metrics.find(m => m.label === 'Valid Opportunities');
    expect(validMetric?.value).toBe('3');
    expect(validMetric?.change).toBe('75.0%');

    const highRiskMetric = result.metrics.find(m => m.label === 'High Risk');
    expect(highRiskMetric?.value).toBe('2');
    expect(highRiskMetric?.change).toBe('50.0%');
  });

  it('should map risk_level correctly (HIGH/MEDIUM/LOW)', () => {
    const riskLevelResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-high',
          opportunityName: 'High Risk',
          stage: 'Proposal',
          amount: 100000,
          riskLevel: 'HIGH',
        } as PlatformAccount,
        {
          opportunityId: 'opp-medium',
          opportunityName: 'Medium Risk',
          stage: 'Negotiation',
          amount: 75000,
          risk_level: 'MEDIUM',
        } as PlatformAccount,
        {
          opportunityId: 'opp-low',
          opportunityName: 'Low Risk',
          stage: 'Discovery',
          amount: 50000,
          riskLevel: 'LOW',
        } as PlatformAccount,
      ],
      total: 3,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(riskLevelResponse);

    expect(result.validations[0].risk_level).toBe('HIGH');
    expect(result.validations[1].risk_level).toBe('MEDIUM');
    expect(result.validations[2].risk_level).toBe('LOW');
  });

  it('should handle missing validation data', () => {
    const missingDataResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          stage: 'Proposal',
          amount: 100000,
        } as PlatformAccount,
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(missingDataResponse);

    expect(result.validations[0]).toEqual({
      opportunity_id: '',
      opportunity_name: 'Unknown',
      account_name: 'Unknown',
      stage: 'Proposal',
      amount: 100000,
      is_valid: false,
      missing_fields: [],
      validation_issues: '',
      risk_level: 'MEDIUM',
    });
  });

  it('should preserve all required fields', () => {
    const fullDataResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-full',
          opportunityName: 'Complete Deal',
          accountName: 'Complete Corp',
          stage: 'Closed Won',
          amount: 200000,
          isValid: true,
          missingFields: [],
          validationIssues: '',
          riskLevel: 'LOW',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(fullDataResponse);

    const validation = result.validations[0];
    expect(validation).toHaveProperty('opportunity_id');
    expect(validation).toHaveProperty('opportunity_name');
    expect(validation).toHaveProperty('account_name');
    expect(validation).toHaveProperty('stage');
    expect(validation).toHaveProperty('amount');
    expect(validation).toHaveProperty('is_valid');
    expect(validation).toHaveProperty('missing_fields');
    expect(validation).toHaveProperty('validation_issues');
    expect(validation).toHaveProperty('risk_level');

    expect(validation.opportunity_id).toBe('opp-full');
    expect(validation.opportunity_name).toBe('Complete Deal');
    expect(validation.account_name).toBe('Complete Corp');
    expect(validation.stage).toBe('Closed Won');
    expect(validation.amount).toBe(200000);
    expect(validation.is_valid).toBe(true);
    expect(validation.missing_fields).toEqual([]);
    expect(validation.validation_issues).toBe('');
    expect(validation.risk_level).toBe('LOW');
  });

  it('should handle empty validations array', () => {
    const emptyResponse: PlatformViewResponse<PlatformAccount> = {
      data: [],
      total: 0,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(emptyResponse);

    expect(result.validations).toHaveLength(0);
    
    const totalMetric = result.metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('0');
    
    const validMetric = result.metrics.find(m => m.label === 'Valid Opportunities');
    expect(validMetric?.value).toBe('0');
    expect(validMetric?.change).toBe('0.0%');
    
    const highRiskMetric = result.metrics.find(m => m.label === 'High Risk');
    expect(highRiskMetric?.value).toBe('0');
    expect(highRiskMetric?.change).toBe('0%');
  });

  it('should normalize camelCase to snake_case for validation fields', () => {
    const camelCaseResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-camel',
          opportunityName: 'CamelCase Validation',
          accountName: 'Camel Account',
          stage: 'Proposal',
          amount: 80000,
          isValid: true,
          missingFields: ['field1'],
          validationIssues: 'Some issues',
          riskLevel: 'MEDIUM',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const snakeCaseResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunity_id: 'opp-snake',
          opportunity_name: 'snake_case Validation',
          account_name: 'Snake Account',
          stage: 'Proposal',
          amount: 80000,
          is_valid: true,
          missing_fields: ['field1'],
          validation_issues: 'Some issues',
          risk_level: 'MEDIUM',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const camelResult = adaptValidationsResponse(camelCaseResponse);
    const snakeResult = adaptValidationsResponse(snakeCaseResponse);

    expect(camelResult.validations[0].opportunity_id).toBe('opp-camel');
    expect(camelResult.validations[0].opportunity_name).toBe('CamelCase Validation');
    expect(camelResult.validations[0].account_name).toBe('Camel Account');
    expect(camelResult.validations[0].is_valid).toBe(true);
    expect(camelResult.validations[0].missing_fields).toEqual(['field1']);
    expect(camelResult.validations[0].validation_issues).toBe('Some issues');
    expect(camelResult.validations[0].risk_level).toBe('MEDIUM');

    expect(snakeResult.validations[0].opportunity_id).toBe('opp-snake');
    expect(snakeResult.validations[0].opportunity_name).toBe('snake_case Validation');
    expect(snakeResult.validations[0].account_name).toBe('Snake Account');
  });

  it('should handle validation with extensive missing fields', () => {
    const missingFieldsResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-missing',
          opportunityName: 'Incomplete Deal',
          stage: 'Discovery',
          amount: 40000,
          isValid: false,
          missingFields: [
            'close_date',
            'contact_email',
            'contact_phone',
            'decision_maker',
            'budget_confirmed',
          ],
          validationIssues: 'Multiple critical fields missing; requires immediate attention',
          riskLevel: 'HIGH',
        } as PlatformAccount,
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptValidationsResponse(missingFieldsResponse);

    expect(result.validations[0].is_valid).toBe(false);
    expect(result.validations[0].missing_fields).toHaveLength(5);
    expect(result.validations[0].missing_fields).toContain('close_date');
    expect(result.validations[0].missing_fields).toContain('budget_confirmed');
    expect(result.validations[0].validation_issues).toContain('critical fields missing');
    expect(result.validations[0].risk_level).toBe('HIGH');
  });
});

describe('adaptOpportunitiesView', () => {
  it('should transform opportunities with all fields present', () => {
    const platformResponse: PlatformViewResponse<PlatformOpportunity> = {
      data: [
        {
          id: 'opp-1',
          name: 'Test Deal',
          accountName: 'Test Account',
          stage: 'Proposal',
          amount: 50000,
          healthScore: 75,
          riskScore: 30,
          isStalled: false,
          lastLoginDays: 5,
          sessions30d: 20,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptOpportunitiesView(platformResponse);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'opp-1',
      name: 'Test Deal',
      account_name: 'Test Account',
      stage: 'Proposal',
      amount: 50000,
      health_score: 75,
      risk_score: 30,
      is_stalled: false,
      last_login_days: 5,
      sessions_30d: 20,
    });
  });
});

describe('adaptAccountsView', () => {
  it('should transform accounts with all fields present', () => {
    const platformResponse: PlatformViewResponse<PlatformAccount> = {
      data: [
        {
          opportunityId: 'opp-1',
          opportunityName: 'Test Validation',
          accountName: 'Test Account',
          stage: 'Proposal',
          amount: 50000,
          isValid: true,
          missingFields: [],
          validationIssues: '',
          riskLevel: 'LOW',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    const result = adaptAccountsView(platformResponse);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      opportunity_id: 'opp-1',
      opportunity_name: 'Test Validation',
      account_name: 'Test Account',
      stage: 'Proposal',
      amount: 50000,
      is_valid: true,
      missing_fields: [],
      validation_issues: '',
      risk_level: 'LOW',
    });
  });
});

describe('calculateMetricsFromOpportunities', () => {
  it('should calculate correct metrics for opportunities', () => {
    const opportunities = [
      {
        id: '1',
        name: 'Deal 1',
        account_name: 'Account 1',
        stage: 'Proposal',
        amount: 100000,
        health_score: 80,
        risk_score: 20,
        is_stalled: false,
      },
      {
        id: '2',
        name: 'Deal 2',
        account_name: 'Account 2',
        stage: 'Negotiation',
        amount: 50000,
        health_score: 40,
        risk_score: 75,
        is_stalled: true,
      },
    ];

    const metrics = calculateMetricsFromOpportunities(opportunities);

    const totalMetric = metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('2');

    const pipelineMetric = metrics.find(m => m.label === 'Pipeline Value');
    expect(pipelineMetric?.value).toBe('$150,000');

    const avgHealthMetric = metrics.find(m => m.label === 'Avg Health Score');
    expect(avgHealthMetric?.value).toBe('60');

    const avgRiskMetric = metrics.find(m => m.label === 'Avg Risk Score');
    expect(avgRiskMetric?.value).toBe('48');
  });

  it('should handle empty opportunities array', () => {
    const metrics = calculateMetricsFromOpportunities([]);

    const totalMetric = metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('0');

    const avgHealthMetric = metrics.find(m => m.label === 'Avg Health Score');
    expect(avgHealthMetric?.value).toBe('0');
  });
});

describe('calculateMetricsFromValidations', () => {
  it('should calculate correct metrics for validations', () => {
    const validations = [
      {
        opportunity_id: '1',
        opportunity_name: 'Deal 1',
        account_name: 'Account 1',
        stage: 'Proposal',
        amount: 100000,
        is_valid: true,
        missing_fields: [],
        validation_issues: '',
        risk_level: 'LOW' as const,
      },
      {
        opportunity_id: '2',
        opportunity_name: 'Deal 2',
        account_name: 'Account 2',
        stage: 'Negotiation',
        amount: 50000,
        is_valid: false,
        missing_fields: ['field1'],
        validation_issues: 'Issues',
        risk_level: 'HIGH' as const,
      },
    ];

    const metrics = calculateMetricsFromValidations(validations);

    const totalMetric = metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('2');

    const validMetric = metrics.find(m => m.label === 'Valid Opportunities');
    expect(validMetric?.value).toBe('1');
    expect(validMetric?.change).toBe('50.0%');

    const highRiskMetric = metrics.find(m => m.label === 'High Risk');
    expect(highRiskMetric?.value).toBe('1');
  });

  it('should handle empty validations array', () => {
    const metrics = calculateMetricsFromValidations([]);

    const totalMetric = metrics.find(m => m.label === 'Total Opportunities');
    expect(totalMetric?.value).toBe('0');

    const validMetric = metrics.find(m => m.label === 'Valid Opportunities');
    expect(validMetric?.value).toBe('0');
    expect(validMetric?.change).toBe('0.0%');
  });
});
