"""
MongoDB Connector for DCL
Integrates with MongoDB for usage and engagement data
Falls back to mock data if connection unavailable
"""

import os
import random
from datetime import datetime, timedelta

class MongoConnector:
    def __init__(self):
        self.connection_string = os.getenv('MONGODB_URI', '').strip()
        self.client = None
        self.db = None
        self.collection = None
        self.is_connected = False
        self.usage_data = {}
        
        self._connect()
    
    def _connect(self):
        """Attempt to connect to MongoDB"""
        if not self.connection_string:
            print("⚠️  MongoDB connection string not found, using mock data")
            return
        
        try:
            from pymongo import MongoClient
            from pymongo.server_api import ServerApi
            import certifi
            
            self.client = MongoClient(
                self.connection_string,
                server_api=ServerApi('1'),
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where()
            )
            
            # Test the connection
            self.client.admin.command('ping')
            
            # Set database and collection
            # Extract database name from connection string or use default
            db_name = os.getenv('MONGODB_DATABASE', 'dcl_demo')
            self.db = self.client[db_name]
            self.collection = self.db['usage_data']
            
            self.is_connected = True
            print(f"✅ Connected to MongoDB: {db_name}")
            
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            print("⚠️  Using mock data instead")
            self.client = None
            self.db = None
            self.collection = None
            self.is_connected = False
    
    def query(self, query_str=None, **kwargs):
        """
        Query MongoDB for usage data
        
        Returns:
            dict: Usage data keyed by account_id
        """
        if self.is_connected and self.collection is not None:
            try:
                # Fetch all usage data from MongoDB
                results = {}
                for doc in self.collection.find():
                    account_id = doc.get('account_id')
                    if account_id:
                        results[account_id] = {
                            "last_login_days": doc.get("last_login_days"),
                            "sessions_30d": doc.get("sessions_30d", 0),
                            "features_used": doc.get("features_used", []),
                            "avg_session_duration": doc.get("avg_session_duration", 0)
                        }
                return results
            except Exception as e:
                print(f"MongoDB query error: {e}")
                return self.usage_data
        
        # Return mock data if not connected
        return self.usage_data
    
    def get_usage_for_account(self, account_id):
        """Get usage data for a specific account"""
        if self.is_connected and self.collection is not None:
            try:
                doc = self.collection.find_one({"account_id": account_id})
                if doc:
                    return {
                        "last_login_days": doc.get("last_login_days"),
                        "sessions_30d": doc.get("sessions_30d", 0),
                        "features_used": doc.get("features_used", []),
                        "avg_session_duration": doc.get("avg_session_duration", 0)
                    }
            except Exception as e:
                print(f"MongoDB query error: {e}")
        
        # Return from cache or default
        return self.usage_data.get(account_id, {
            "last_login_days": None,
            "sessions_30d": 0,
            "features_used": [],
            "avg_session_duration": 0
        })
    
    def add_usage_data(self, account_id, data):
        """Add or update usage data for an account"""
        usage_doc = {
            "account_id": account_id,
            "last_login_days": data.get("last_login_days", random.randint(1, 60)),
            "sessions_30d": data.get("sessions_30d", random.randint(0, 100)),
            "features_used": data.get("features_used", []),
            "avg_session_duration": data.get("avg_session_duration", random.randint(5, 60)),
            "updated_at": datetime.utcnow()
        }
        
        if self.is_connected and self.collection is not None:
            try:
                self.collection.update_one(
                    {"account_id": account_id},
                    {"$set": usage_doc},
                    upsert=True
                )
            except Exception as e:
                print(f"MongoDB write error: {e}")
        
        # Also cache locally
        self.usage_data[account_id] = {
            "last_login_days": usage_doc["last_login_days"],
            "sessions_30d": usage_doc["sessions_30d"],
            "features_used": usage_doc["features_used"],
            "avg_session_duration": usage_doc["avg_session_duration"]
        }
    
    def populate_from_accounts(self, account_ids):
        """Populate usage data based on account IDs from other sources"""
        for account_id in account_ids:
            # Check if data already exists (in MongoDB or local cache)
            existing = self.get_usage_for_account(account_id)
            if existing.get("last_login_days") is not None:
                continue
            
            # Generate realistic mock data for new accounts
            last_login = random.randint(1, 90)
            self.add_usage_data(account_id, {
                "last_login_days": last_login,
                "sessions_30d": random.randint(0, 50) if last_login < 30 else random.randint(0, 5),
                "features_used": random.sample([
                    "dashboard", "reports", "api", "integrations", 
                    "analytics", "export", "alerts", "automation"
                ], random.randint(1, 5)),
                "avg_session_duration": random.randint(5, 45)
            })


def create_mongo_connector():
    """Factory function to create MongoDB connector for DCL"""
    connector = MongoConnector()
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    status = "active" if connector.is_connected else "disconnected"
    type_label = "MongoDB" if connector.is_connected else "MongoDB (Mock)"
    description = "Usage and engagement data" if connector.is_connected else "Usage and engagement data (simulated)"
    
    return query_fn, {
        "type": type_label,
        "status": status,
        "description": description
    }, connector
