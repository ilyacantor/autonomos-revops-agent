"""
Salesforce Connector for DCL
Integrates with Salesforce Sandbox API to fetch CRM data
"""

import os
from simple_salesforce.api import Salesforce
import pandas as pd
from connectors.exceptions import ConnectorConfigurationError

class SalesforceConnector:
    def __init__(self, allow_mock=False):
        self.username = os.getenv('SALESFORCE_USERNAME', '')
        self.password = os.getenv('SALESFORCE_PASSWORD', '')
        self.security_token = os.getenv('SALESFORCE_SECURITY_TOKEN', '')
        self.domain = os.getenv('SALESFORCE_DOMAIN', 'test')  # 'test' for sandbox
        self.allow_mock = allow_mock
        self.sf = None
        self.config_error = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Salesforce"""
        missing_vars = []
        if not self.username:
            missing_vars.append('SALESFORCE_USERNAME')
        if not self.password:
            missing_vars.append('SALESFORCE_PASSWORD')
        if not self.security_token:
            missing_vars.append('SALESFORCE_SECURITY_TOKEN')
        
        if missing_vars:
            error_msg = f"Missing required Salesforce credentials: {', '.join(missing_vars)}"
            self.config_error = error_msg
            if not self.allow_mock:
                raise ConnectorConfigurationError(error_msg)
            print(f"⚠️  {error_msg} - using mock data (allow_mock=True)")
            return
        
        try:
            self.sf = Salesforce(
                username=self.username,
                password=self.password,
                security_token=self.security_token,
                domain=self.domain
            )
        except Exception as e:
            error_msg = f"Salesforce connection error: {e}"
            self.config_error = error_msg
            print(f"⚠️  {error_msg}")
            self.sf = None
    
    def query(self, query_str=None, **kwargs):
        """
        Execute SOQL query on Salesforce
        
        Args:
            query_str (str): SOQL query string
            
        Returns:
            list: Query results as list of dictionaries
        """
        if not self.sf:
            if self.allow_mock:
                print("⚠️  Salesforce not connected, using mock data (allow_mock=True)")
                return self._get_mock_data()
            else:
                error_msg = self.config_error or "Salesforce not connected"
                raise ConnectorConfigurationError(f"Cannot query Salesforce: {error_msg}")
        
        # Default query for opportunities if none provided
        if not query_str:
            query_str = """
                SELECT Id, Name, AccountId, StageName, Amount, CloseDate, 
                       Probability, Type, LeadSource, Account.Name
                FROM Opportunity
                WHERE IsClosed = false
                ORDER BY CloseDate ASC
                LIMIT 100
            """
        
        try:
            result = self.sf.query(query_str)
            records = result['records']
            
            # Clean up Salesforce metadata
            cleaned_records = []
            for record in records:
                cleaned = {k: v for k, v in record.items() if k != 'attributes'}
                
                # Handle nested Account data
                if 'Account' in cleaned and cleaned['Account']:
                    account = cleaned['Account']
                    cleaned['AccountName'] = account.get('Name', '')
                    del cleaned['Account']
                
                cleaned_records.append(cleaned)
            
            return cleaned_records
            
        except Exception as e:
            raise Exception(f"Salesforce query error: {str(e)}")
    
    def _get_mock_data(self):
        """Return mock opportunity data when real data is unavailable"""
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        return [
            {
                "Id": "0065g00000MOCK1AAA",
                "Name": "Mock Deal - Enterprise Software License",
                "AccountId": "0015g00000XYZ1QAAX",
                "AccountName": "Mock Corp Industries",
                "StageName": "Proposal/Price Quote",
                "Amount": 75000,
                "CloseDate": future_date,
                "Probability": 75,
                "Type": "New Business",
                "LeadSource": "Web"
            },
            {
                "Id": "0065g00000MOCK2AAA",
                "Name": "Mock Deal - Cloud Migration Services",
                "AccountId": "0015g00000ABC2QAAX",
                "AccountName": "Demo Solutions LLC",
                "StageName": "Negotiation/Review",
                "Amount": 120000,
                "CloseDate": future_date,
                "Probability": 60,
                "Type": "Existing Business",
                "LeadSource": "Partner Referral"
            },
            {
                "Id": "0065g00000MOCK3AAA",
                "Name": "Mock Deal - Data Analytics Platform",
                "AccountId": "0015g00000DEF3QAAX",
                "AccountName": "Test Enterprises",
                "StageName": "Value Proposition",
                "Amount": 45000,
                "CloseDate": future_date,
                "Probability": 50,
                "Type": "New Business",
                "LeadSource": "Inbound"
            },
            {
                "Id": "0065g00000MOCK4AAA",
                "Name": "Mock Deal - Professional Services",
                "AccountId": "0015g00000GHI4QAAX",
                "AccountName": "Sample Tech Co",
                "StageName": "Qualification",
                "Amount": 15000,
                "CloseDate": future_date,
                "Probability": 25,
                "Type": "New Business",
                "LeadSource": "Campaign"
            },
            {
                "Id": "0065g00000MOCK5AAA",
                "Name": "Mock Deal - Annual Subscription Renewal",
                "AccountId": "0015g00000JKL5QAAX",
                "AccountName": "Example Systems Inc",
                "StageName": "Needs Analysis",
                "Amount": 95000,
                "CloseDate": future_date,
                "Probability": 80,
                "Type": "Existing Business",
                "LeadSource": "Customer"
            }
        ]
    
    def get_accounts(self):
        """Fetch Salesforce accounts"""
        query = """
            SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees
            FROM Account
            WHERE IsDeleted = false
            LIMIT 100
        """
        return self.query(query)
    
    def get_opportunities_by_stage(self, stage=None):
        """Fetch opportunities filtered by stage"""
        if stage:
            query = f"""
                SELECT Id, Name, AccountId, StageName, Amount, CloseDate
                FROM Opportunity
                WHERE StageName = '{stage}' AND IsClosed = false
            """
        else:
            query = """
                SELECT Id, Name, AccountId, StageName, Amount, CloseDate
                FROM Opportunity
                WHERE IsClosed = false
            """
        return self.query(query)


def create_salesforce_connector(allow_mock=False):
    """Factory function to create Salesforce connector for DCL"""
    connector = SalesforceConnector(allow_mock=allow_mock)
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    status = "healthy" if connector.sf else ("mock" if allow_mock else "failed")
    
    metadata = {
        "type": "Salesforce CRM",
        "status": status,
        "description": "Salesforce Sandbox - Opportunities, Accounts, Leads"
    }
    
    if connector.config_error:
        metadata["error"] = connector.config_error
    
    return query_fn, metadata
