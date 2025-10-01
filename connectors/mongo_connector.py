"""
MongoDB Mock Connector for DCL
Simulates usage and engagement data
"""

import random
from datetime import datetime, timedelta

class MongoMockConnector:
    def __init__(self):
        # Mock data for demonstration
        self.usage_data = self._generate_mock_data()
    
    def _generate_mock_data(self):
        """Generate mock usage and engagement data"""
        # This will be dynamically generated based on available account IDs
        return {}
    
    def query(self, query_str=None, **kwargs):
        """
        Mock query for MongoDB
        
        Returns:
            dict: Usage data keyed by account_id
        """
        # Return all usage data
        return self.usage_data
    
    def get_usage_for_account(self, account_id):
        """Get usage data for a specific account"""
        return self.usage_data.get(account_id, {
            "last_login_days": None,
            "sessions_30d": 0,
            "features_used": [],
            "avg_session_duration": 0
        })
    
    def add_usage_data(self, account_id, data):
        """Add or update usage data for an account"""
        self.usage_data[account_id] = {
            "last_login_days": data.get("last_login_days", random.randint(1, 60)),
            "sessions_30d": data.get("sessions_30d", random.randint(0, 100)),
            "features_used": data.get("features_used", []),
            "avg_session_duration": data.get("avg_session_duration", random.randint(5, 60))
        }
    
    def populate_from_accounts(self, account_ids):
        """Populate mock data based on account IDs from other sources"""
        for account_id in account_ids:
            if account_id not in self.usage_data:
                # Generate realistic mock data
                last_login = random.randint(1, 90)
                self.usage_data[account_id] = {
                    "last_login_days": last_login,
                    "sessions_30d": random.randint(0, 50) if last_login < 30 else random.randint(0, 5),
                    "features_used": random.sample([
                        "dashboard", "reports", "api", "integrations", 
                        "analytics", "export", "alerts", "automation"
                    ], random.randint(1, 5)),
                    "avg_session_duration": random.randint(5, 45)
                }


def create_mongo_connector():
    """Factory function to create MongoDB mock connector for DCL"""
    connector = MongoMockConnector()
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    return query_fn, {
        "type": "MongoDB (Mock)",
        "status": "active",
        "description": "Usage and engagement data (simulated)"
    }, connector
