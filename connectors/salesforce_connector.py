"""
Salesforce Connector for DCL
Integrates with Salesforce Sandbox API to fetch CRM data
"""

import os
from simple_salesforce import Salesforce
import pandas as pd

class SalesforceConnector:
    def __init__(self):
        self.username = os.getenv('SALESFORCE_USERNAME', '')
        self.password = os.getenv('SALESFORCE_PASSWORD', '')
        self.security_token = os.getenv('SALESFORCE_SECURITY_TOKEN', '')
        self.domain = os.getenv('SALESFORCE_DOMAIN', 'test')  # 'test' for sandbox
        self.sf = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Salesforce"""
        try:
            if self.username and self.password:
                self.sf = Salesforce(
                    username=self.username,
                    password=self.password,
                    security_token=self.security_token,
                    domain=self.domain
                )
        except Exception as e:
            print(f"Salesforce connection error: {e}")
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
            raise ConnectionError("Salesforce connection not established. Please check credentials.")
        
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


def create_salesforce_connector():
    """Factory function to create Salesforce connector for DCL"""
    connector = SalesforceConnector()
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    return query_fn, {
        "type": "Salesforce CRM",
        "status": "active" if connector.sf else "disconnected",
        "description": "Salesforce Sandbox - Opportunities, Accounts, Leads"
    }
