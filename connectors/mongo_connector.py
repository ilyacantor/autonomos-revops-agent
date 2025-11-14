"""
MongoDB Connector for DCL
Integrates with MongoDB for usage and engagement data
Falls back to mock data if connection unavailable
"""

import os
import time
import random
from datetime import datetime, timedelta
from connectors.exceptions import ConnectorConfigurationError

class MongoConnector:
    def __init__(self, allow_mock=False):
        self.connection_string = os.getenv('MONGODB_URI', '').strip()
        self.database_name = os.getenv('MONGODB_DATABASE', '').strip()
        self.allow_mock = allow_mock
        self.client = None
        self.db = None
        self.collection = None
        self.is_connected = False
        self.usage_data = {}
        self.config_error = None
        self._health_cache = None
        self._health_cache_time = 0
        self._health_cache_ttl = 60  # Cache health checks for 60 seconds
        
        self._connect()
    
    def _connect(self):
        """Attempt to connect to MongoDB"""
        missing_vars = []
        if not self.connection_string:
            missing_vars.append('MONGODB_URI')
        if not self.database_name:
            missing_vars.append('MONGODB_DATABASE')
        
        if missing_vars:
            error_msg = f"Missing required MongoDB credentials: {', '.join(missing_vars)}"
            self.config_error = error_msg
            if not self.allow_mock:
                raise ConnectorConfigurationError(error_msg)
            print(f"⚠️  {error_msg} - using mock data (allow_mock=True)")
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
            self.db = self.client[self.database_name]
            self.collection = self.db['usage_data']
            
            self.is_connected = True
            print(f"✅ Connected to MongoDB: {self.database_name}")
            
        except Exception as e:
            error_msg = f"MongoDB connection error: {e}"
            self.config_error = error_msg
            print(f"⚠️  {error_msg}")
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
                if self.allow_mock:
                    return self.usage_data
                raise
        
        # Return mock data if not connected and mock allowed
        if self.allow_mock:
            return self.usage_data
        else:
            error_msg = self.config_error or "MongoDB not connected"
            raise ConnectorConfigurationError(f"Cannot query MongoDB: {error_msg}")
    
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
        """Check if MongoDB connection is healthy (cached to avoid blocking I/O)"""
        # Return cached result if still valid and not forcing
        if not force and self.is_health_cache_fresh():
            return self._health_cache
        
        # Perform actual health check
        current_time = time.time()
        try:
            if self.client is not None and self.db is not None:
                # Ping database
                self.client.admin.command('ping')
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
            try:
                self.client.close()
            except Exception:
                pass  # Ignore errors during cleanup
            self.client = None
            self.db = None
            self.collection = None
            self.is_connected = False
        self._health_cache = None
        self._health_cache_time = 0
    
    def reconnect(self):
        """Attempt to reconnect to MongoDB"""
        self.close()
        self._connect()


def create_mongo_connector(allow_mock=False):
    """Factory function to create MongoDB connector for DCL"""
    connector = MongoConnector(allow_mock=allow_mock)
    
    def query_fn(query_str=None, **kwargs):
        return connector.query(query_str, **kwargs)
    
    status = "healthy" if connector.is_connected else ("mock" if allow_mock else "failed")
    
    metadata = {
        "type": "MongoDB",
        "status": status,
        "description": "Usage and engagement data"
    }
    
    if connector.config_error:
        metadata["error"] = connector.config_error
    
    return query_fn, metadata, connector
