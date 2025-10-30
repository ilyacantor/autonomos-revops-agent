"""
Pipeline Health Workflow
Multi-source data join dashboard showing stalled deals with health scores
"""

import pandas as pd
from datetime import datetime, timedelta

class PipelineHealthWorkflow:
    def __init__(self, dcl):
        self.dcl = dcl
        self.health_data_loaded = False
        self.usage_data_loaded = False
        self.data_quality_warnings = []
    
    def run(self):
        """
        Execute pipeline health workflow:
        1. Fetch opportunities from Salesforce
        2. Fetch health scores from Supabase
        3. Fetch usage data from MongoDB
        4. Join and analyze
        
        Returns:
            pd.DataFrame: Comprehensive pipeline health report
        """
        # Step 1: Fetch opportunities from Salesforce
        opportunities = self.dcl.query('salesforce')
        
        if not opportunities:
            return pd.DataFrame()
        
        # Step 2: Fetch health scores from Supabase
        self.data_quality_warnings = []
        try:
            health_data = self.dcl.query('supabase', table='customer_health')
            health_map = {
                item['account_id']: item.get('health_score', 0)
                for item in health_data
            } if health_data else {}
            self.health_data_loaded = bool(health_data)
            if not health_data:
                self.data_quality_warnings.append("No health score data available from Supabase")
        except Exception as e:
            print(f"Health data fetch error: {e}")
            health_map = {}
            self.health_data_loaded = False
            self.data_quality_warnings.append(f"Failed to load health data: {str(e)}")
        
        # Step 3: Fetch usage data from MongoDB
        try:
            usage_data = self.dcl.query('mongodb')
            self.usage_data_loaded = bool(usage_data)
            if not usage_data:
                self.data_quality_warnings.append("No usage data available from MongoDB")
        except Exception as e:
            print(f"Usage data fetch error: {e}")
            usage_data = {}
            self.usage_data_loaded = False
            self.data_quality_warnings.append(f"Failed to load usage data: {str(e)}")
        
        # Step 4: Join data and create comprehensive view
        pipeline_data = []
        
        for opp in opportunities:
            account_id = opp.get('AccountId', '')
            
            # Get health score
            health_score = health_map.get(account_id, 0)
            
            # Get usage metrics
            usage = usage_data.get(account_id, {})
            last_login_days = usage.get('last_login_days')
            sessions_30d = usage.get('sessions_30d', 0)
            
            # Calculate days in current stage
            close_date = opp.get('CloseDate')
            days_to_close = None
            if close_date:
                try:
                    close_dt = datetime.fromisoformat(close_date.replace('Z', '+00:00'))
                    days_to_close = (close_dt - datetime.now()).days
                except:
                    pass
            
            # Calculate risk score (independent of health)
            risk_score = self._calculate_risk_score(
                last_login_days,
                sessions_30d,
                days_to_close,
                opp.get('Probability', 0)
            )
            
            # Determine if deal is stalled (considers both health and risk)
            is_stalled = self._is_deal_stalled(
                health_score,
                risk_score,
                last_login_days, 
                sessions_30d, 
                days_to_close
            )
            
            pipeline_data.append({
                'Opportunity ID': opp.get('Id'),
                'Opportunity Name': opp.get('Name'),
                'Account Name': opp.get('AccountName', ''),
                'Stage': opp.get('StageName'),
                'Amount': opp.get('Amount', 0),
                'Close Date': close_date,
                'Days to Close': days_to_close,
                'Probability': opp.get('Probability', 0),
                'Health Score': health_score,
                'Last Login (days)': last_login_days,
                'Sessions (30d)': sessions_30d,
                'Risk Score': risk_score,
                'Is Stalled': is_stalled,
                'Recommendation': self._get_recommendation(is_stalled, risk_score, health_score)
            })
        
        return pd.DataFrame(pipeline_data)
    
    def _is_deal_stalled(self, health_score, risk_score, last_login_days, sessions_30d, days_to_close):
        """Determine if a deal is stalled based on multiple signals"""
        stall_signals = 0
        
        # Low health score
        if health_score < 50:
            stall_signals += 1
        
        # High risk score
        if risk_score > 60:
            stall_signals += 1
        
        # Inactive usage
        if last_login_days and last_login_days > 14:
            stall_signals += 1
        
        # Low engagement
        if sessions_30d < 5:
            stall_signals += 1
        
        # Close date far out or passed
        if days_to_close:
            if days_to_close < 0 or days_to_close > 90:
                stall_signals += 1
        
        return stall_signals >= 2
    
    def _calculate_risk_score(self, last_login_days, sessions_30d, days_to_close, probability):
        """Calculate risk score independent of health (0-100, higher = more risk)"""
        risk = 0
        
        # Usage/Engagement Component (0-40 points)
        if last_login_days:
            risk += min(last_login_days / 60 * 40, 40)
        else:
            risk += 25
        
        # Low sessions component (0-20 points max from sessions)
        risk += max(0, (10 - sessions_30d) / 10 * 20)
        
        # Timeline Component (0-30 points)
        if days_to_close:
            if days_to_close < 0:
                risk += 30
            elif days_to_close > 90:
                risk += 20
            elif days_to_close > 60:
                risk += 10
            else:
                risk += 5
        else:
            risk += 5
        
        # Probability Component (0-30 points)
        risk += (100 - probability) * 0.3
        
        return min(100, max(0, risk))
    
    def _get_recommendation(self, is_stalled, risk_score, health_score):
        """Provide action recommendation based on analysis"""
        if is_stalled and risk_score > 70:
            return "URGENT: Schedule executive review"
        elif is_stalled and risk_score > 50:
            return "ACTION: Re-engage customer immediately"
        elif risk_score > 60:
            return "MONITOR: Increase touch points"
        elif health_score < 50:
            return "SUPPORT: Provide customer success intervention"
        else:
            return "HEALTHY: Continue normal cadence"
    
    def get_stalled_deals(self):
        """Get filtered list of stalled deals only"""
        df = self.run()
        
        if df.empty:
            return df
        
        return df[df['Is Stalled'] == True].sort_values('Risk Score', ascending=False)
    
    def get_summary_metrics(self):
        """Get summary metrics for dashboard"""
        df = self.run()
        
        if df.empty:
            return {}
        
        return {
            'total_opportunities': len(df),
            'total_pipeline_value': df['Amount'].sum(),
            'stalled_deals': df['Is Stalled'].sum(),
            'high_risk_deals': len(df[df['Risk Score'] > 70]),
            'avg_health_score': df['Health Score'].mean(),
            'avg_risk_score': df['Risk Score'].mean()
        }
    
    def get_data_quality_report(self):
        """Return dict with data quality flags"""
        return {
            'health_data_loaded': self.health_data_loaded,
            'usage_data_loaded': self.usage_data_loaded,
            'warnings': self.data_quality_warnings
        }
