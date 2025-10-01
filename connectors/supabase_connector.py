"""
Supabase PostgreSQL Connector for DCL
Handles customer health scores and metrics
"""

import os
from supabase import create_client, Client
import pandas as pd

class SupabaseConnector:
    def __init__(self):
        self.url = os.getenv('SUPABASE_URL', '')
        self.key = os.getenv('SUPABASE_KEY', '')
        self.client = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Supabase"""
        try:
            if self.url and self.key:
                self.client = create_client(self.url, self.key)
        except Exception as e:
            print(f"Supabase connection error: {e}")
            self.client = None
    
    def query(self, query_str=None, **kwargs):
        """
        Query Supabase PostgreSQL database
        
        Args:
            query_str (str): Table name or custom query parameters
            **kwargs: Additional query parameters (table, columns, filters)
            
        Returns:
            list: Query results as list of dictionaries
        """
        if not self.client:
            print("⚠️  Supabase not connected, using mock data")
            return self._get_mock_data()
        
        # Default to customer_health table if no query specified
        table_name = kwargs.get('table', query_str or 'customer_health')
        
        try:
            # Fetch data from the specified table
            response = self.client.table(table_name).select("*").execute()
            return response.data
            
        except Exception as e:
            # If table doesn't exist, return mock data for demo purposes
            if 'PGRST205' in str(e) or 'not find the table' in str(e):
                print(f"⚠️  Table '{table_name}' not found in Supabase, using mock data")
                return self._get_mock_data()
            raise Exception(f"Supabase query error: {str(e)}")
    
    def _get_mock_data(self):
        """Return mock health data when real data is unavailable"""
        return [
            {"account_id": "0015g00000XYZ1QAAX", "health_score": 85, "details": "Mock: High engagement"},
            {"account_id": "0015g00000ABC2QAAX", "health_score": 45, "details": "Mock: Low activity"},
            {"account_id": "0015g00000DEF3QAAX", "health_score": 92, "details": "Mock: Excellent health"},
            {"account_id": "0015g00000GHI4QAAX", "health_score": 38, "details": "Mock: At risk"},
            {"account_id": "0015g00000JKL5QAAX", "health_score": 67, "details": "Mock: Moderate engagement"},
        ]
    
    def get_health_scores(self, account_id=None):
        """Fetch customer health scores"""
        if not self.client:
            return self._get_mock_data()
            
        try:
            query = self.client.table('customer_health').select('*')
            
            if account_id:
                query = query.eq('account_id', account_id)
            
            response = query.execute()
            return response.data
            
        except Exception as e:
            raise Exception(f"Error fetching health scores: {str(e)}")
    
    def get_metrics(self, metric_type=None):
        """Fetch customer metrics"""
        if not self.client:
            return []
            
        try:
            query = self.client.table('customer_metrics').select('*')
            
            if metric_type:
                query = query.eq('metric_type', metric_type)
            
            response = query.execute()
            return response.data
            
        except Exception as e:
            raise Exception(f"Error fetching metrics: {str(e)}")
    
    def upsert_health_score(self, account_id, score, details=None):
        """Update or insert health score for an account"""
        if not self.client:
            return []
            
        try:
            data = {
                'account_id': account_id,
                'health_score': score,
                'last_updated': 'now()'
            }
            if details:
                data['details'] = details
            
            response = self.client.table('customer_health').upsert(data).execute()
            return response.data
            
        except Exception as e:
            raise Exception(f"Error upserting health score: {str(e)}")


def create_supabase_connector():
    """Factory function to create Supabase connector for DCL"""
    connector = SupabaseConnector()
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    return query_fn, {
        "type": "Supabase PostgreSQL",
        "status": "active" if connector.client else "disconnected",
        "description": "Customer health scores and engagement metrics"
    }
