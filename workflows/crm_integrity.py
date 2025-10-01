"""
CRM Integrity Workflow
Implements BANT validation rules with stage gate enforcement
"""

import pandas as pd
from datetime import datetime

class CRMIntegrityWorkflow:
    """
    BANT Validation Framework:
    - Budget: Opportunity amount validation
    - Authority: Decision maker validation
    - Need: Business need assessment
    - Timeline: Close date validation
    """
    
    def __init__(self, dcl):
        self.dcl = dcl
        self.validation_rules = {
            'Prospecting': {
                'min_amount': 0,
                'required_fields': ['Name', 'AccountId'],
                'max_days_to_close': 365
            },
            'Qualification': {
                'min_amount': 5000,
                'required_fields': ['Name', 'AccountId', 'Amount'],
                'max_days_to_close': 180
            },
            'Needs Analysis': {
                'min_amount': 10000,
                'required_fields': ['Name', 'AccountId', 'Amount', 'Type'],
                'max_days_to_close': 120
            },
            'Value Proposition': {
                'min_amount': 15000,
                'required_fields': ['Name', 'AccountId', 'Amount', 'Type'],
                'max_days_to_close': 90
            },
            'Proposal/Price Quote': {
                'min_amount': 20000,
                'required_fields': ['Name', 'AccountId', 'Amount', 'Type', 'LeadSource'],
                'max_days_to_close': 60
            },
            'Negotiation/Review': {
                'min_amount': 25000,
                'required_fields': ['Name', 'AccountId', 'Amount', 'Type', 'LeadSource'],
                'max_days_to_close': 30
            },
            'Closed Won': {
                'min_amount': 0,
                'required_fields': ['Name', 'AccountId', 'Amount'],
                'max_days_to_close': 0
            }
        }
    
    def validate_bant(self, opportunity):
        """
        Validate BANT criteria for an opportunity
        
        Returns:
            dict: Validation results with pass/fail status and issues
        """
        stage = opportunity.get('StageName', '')
        rules = self.validation_rules.get(stage, {})
        
        issues = []
        warnings = []
        
        # Budget validation
        amount = opportunity.get('Amount', 0) or 0
        min_amount = rules.get('min_amount', 0)
        if amount < min_amount:
            issues.append(f"Budget: Amount ${amount:,} below minimum ${min_amount:,} for {stage}")
        
        # Authority validation (required fields check)
        required_fields = rules.get('required_fields', [])
        for field in required_fields:
            if not opportunity.get(field):
                issues.append(f"Authority: Missing required field '{field}'")
        
        # Need validation (Type field indicates business need)
        if stage not in ['Prospecting', 'Qualification']:
            if not opportunity.get('Type'):
                warnings.append("Need: Opportunity type not specified")
        
        # Timeline validation
        close_date = opportunity.get('CloseDate')
        max_days = rules.get('max_days_to_close', 365)
        
        if close_date:
            try:
                close_dt = datetime.fromisoformat(close_date.replace('Z', '+00:00'))
                days_to_close = (close_dt - datetime.now()).days
                
                if days_to_close < 0:
                    issues.append("Timeline: Close date is in the past")
                elif days_to_close > max_days:
                    warnings.append(f"Timeline: Close date {days_to_close} days away (max {max_days} for {stage})")
            except:
                warnings.append("Timeline: Invalid close date format")
        else:
            issues.append("Timeline: Close date not set")
        
        return {
            'opportunity_id': opportunity.get('Id'),
            'opportunity_name': opportunity.get('Name'),
            'stage': stage,
            'is_valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'risk_level': 'HIGH' if len(issues) > 2 else 'MEDIUM' if len(issues) > 0 or len(warnings) > 1 else 'LOW'
        }
    
    def run_validation(self):
        """
        Run BANT validation on all opportunities from Salesforce
        
        Returns:
            pd.DataFrame: Validation results with recommendations
        """
        # Fetch opportunities from Salesforce via DCL
        opportunities = self.dcl.query('salesforce')
        
        if not opportunities:
            return pd.DataFrame()
        
        # Run validation on each opportunity
        validation_results = []
        for opp in opportunities:
            result = self.validate_bant(opp)
            validation_results.append(result)
        
        return pd.DataFrame(validation_results)
    
    def get_stage_gate_violations(self):
        """
        Identify opportunities that violate stage gate rules
        
        Returns:
            list: Opportunities requiring immediate attention
        """
        results = self.run_validation()
        
        if results.empty:
            return []
        
        # Filter for high-risk violations
        violations = results[results['risk_level'] == 'HIGH'].to_dict('records')
        
        return violations
    
    def get_escalation_items(self):
        """
        Get items that need human-in-the-loop escalation
        
        Returns:
            list: Items for Slack alerts
        """
        violations = self.get_stage_gate_violations()
        
        escalation_items = []
        for violation in violations:
            escalation_items.append({
                'type': 'BANT_VIOLATION',
                'opportunity_id': violation['opportunity_id'],
                'opportunity_name': violation['opportunity_name'],
                'stage': violation['stage'],
                'issues': violation['issues'],
                'action_required': 'Review and update opportunity or revert stage'
            })
        
        return escalation_items
