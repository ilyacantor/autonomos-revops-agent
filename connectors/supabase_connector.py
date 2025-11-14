"""
Supabase PostgreSQL Connector for DCL
Handles customer health scores and metrics
"""

import os
import time
from supabase import create_client, Client
import pandas as pd
from connectors.exceptions import ConnectorConfigurationError

class SupabaseConnector:
    def __init__(self, allow_mock=False):
        self.url = os.getenv('SUPABASE_URL', '')
        self.key = os.getenv('SUPABASE_KEY', '')
        self.allow_mock = allow_mock
        self.client = None
        self.config_error = None
        self._health_cache = None
        self._health_cache_time = 0
        self._health_cache_ttl = 60  # Cache health checks for 60 seconds
        self._connect()
    
    def _connect(self):
        """Establish connection to Supabase"""
        missing_vars = []
        if not self.url:
            missing_vars.append('SUPABASE_URL')
        if not self.key:
            missing_vars.append('SUPABASE_KEY')
        
        if missing_vars:
            error_msg = f"Missing required Supabase credentials: {', '.join(missing_vars)}"
            self.config_error = error_msg
            if not self.allow_mock:
                raise ConnectorConfigurationError(error_msg)
            print(f"⚠️  {error_msg} - using mock data (allow_mock=True)")
            return
        
        try:
            self.client = create_client(self.url, self.key)
        except Exception as e:
            error_msg = f"Supabase connection error: {e}"
            self.config_error = error_msg
            print(f"⚠️  {error_msg}")
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
            if self.allow_mock:
                print("⚠️  Supabase not connected, using mock data (allow_mock=True)")
                return self._get_mock_data()
            else:
                error_msg = self.config_error or "Supabase not connected"
                raise ConnectorConfigurationError(f"Cannot query Supabase: {error_msg}")
        
        # Use the actual table name that exists
        table_name = kwargs.get('table', query_str or 'salesforce_health_scores')
        
        try:
            # Fetch data from the specified table
            response = self.client.table(table_name).select("*").execute()
            
            # Normalize the response to use 'account_id' for compatibility
            data = response.data
            if data and 'salesforce_id' in data[0]:
                # Rename salesforce_id to account_id for compatibility
                for item in data:
                    item['account_id'] = item.get('salesforce_id', item.get('account_id', ''))
            
            return data
            
        except Exception as e:
            # If table doesn't exist and mock mode enabled, return mock data
            if 'PGRST205' in str(e) or 'not find the table' in str(e):
                if self.allow_mock:
                    print(f"⚠️  Table '{table_name}' not found in Supabase, using mock data (allow_mock=True)")
                    return self._get_mock_data()
                else:
                    raise Exception(f"Supabase table '{table_name}' not found: {str(e)}")
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
            query = self.client.table('salesforce_health_scores').select('*')
            
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
            
            response = self.client.table('salesforce_health_scores').upsert(data).execute()
            return response.data
            
        except Exception as e:
            raise Exception(f"Error upserting health score: {str(e)}")
    
    def is_health_cache_fresh(self) -> bool:
        """Check if health cache is still fresh (within TTL)"""
        if self._health_cache is None:
            return False
        current_time = time.time()
        return (current_time - self._health_cache_time) < self._health_cache_ttl
    
    def get_cached_health(self) -> dict:
        """Get cached health without performing check"""
        return self._health_cache
    
    def check_health(self, force: bool = False) -> dict:
        """Check if Supabase connection is healthy (cached to avoid blocking I/O)"""
        # Return cached result if still valid and not forcing
        if not force and self.is_health_cache_fresh():
            return self._health_cache
        
        # Perform actual health check
        current_time = time.time()
        try:
            if self.client:
                # Simple query to verify connection
                self.client.table('salesforce_health_scores').select('id').limit(1).execute()
                result = {"healthy": True, "error": None}
            else:
                result = {"healthy": False, "error": self.config_error or "Client not initialized"}
        except Exception as e:
            result = {"healthy": False, "error": str(e)}
        
        # Cache the result
        self._health_cache = result
        self._health_cache_time = current_time
        return result
    
    def close(self):
        """Clean up connection resources"""
        if self.client:
            # Supabase uses httpx/requests internally - close session
            if hasattr(self.client, '_client') and hasattr(self.client._client, 'aclose'):
                try:
                    import asyncio
                    # Check if event loop is already running (FastAPI context)
                    try:
                        loop = asyncio.get_running_loop()
                        # Loop is running - schedule task instead of run_until_complete
                        loop.create_task(self.client._client.aclose())
                    except RuntimeError:
                        # No running loop - safe to use run_until_complete
                        asyncio.run(self.client._client.aclose())
                except Exception:
                    pass  # Ignore errors during cleanup
            self.client = None
        self._health_cache = None
        self._health_cache_time = 0
    
    def reconnect(self):
        """Attempt to reconnect to Supabase"""
        self.close()
        self._connect()


def create_supabase_connector(allow_mock=False):
    """Factory function to create Supabase connector for DCL"""
    connector = SupabaseConnector(allow_mock=allow_mock)
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    status = "healthy" if connector.client else ("mock" if allow_mock else "failed")
    
    metadata = {
        "type": "Supabase PostgreSQL",
        "status": status,
        "description": "Customer health scores and engagement metrics"
    }
    
    if connector.config_error:
        metadata["error"] = connector.config_error
    
    return query_fn, metadata, connector
