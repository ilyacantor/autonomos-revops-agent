"""
DCL (Data Connectivity Layer) Core Abstraction
Provides a unified interface for registering and querying data sources
"""

class DCL:
    def __init__(self):
        self.connectors = {}
        self.connector_metadata = {}
    
    def register_connector(self, name, query_fn, metadata=None):
        """
        Register a new data source by name with its query function.
        
        Args:
            name (str): Unique identifier for the connector
            query_fn (callable): Function to query the data source
            metadata (dict): Optional metadata about the connector
        """
        self.connectors[name] = query_fn
        self.connector_metadata[name] = metadata or {
            "type": "unknown",
            "status": "active",
            "description": f"Connector for {name}"
        }
    
    def query(self, name, query_str=None, **kwargs):
        """
        Route query through the registered connector.
        
        Args:
            name (str): Name of the connector to use
            query_str (str): Optional query string
            **kwargs: Additional arguments passed to the connector
            
        Returns:
            Query results from the connector
            
        Raises:
            ValueError: If connector is not registered
        """
        if name not in self.connectors:
            raise ValueError(f"No connector registered for '{name}'. Available connectors: {list(self.connectors.keys())}")
        
        return self.connectors[name](query_str, **kwargs)
    
    def get_registered_connectors(self):
        """Return list of all registered connector names with metadata"""
        return [
            {
                "name": name,
                **self.connector_metadata.get(name, {})
            }
            for name in self.connectors.keys()
        ]
    
    def unregister_connector(self, name):
        """Remove a connector from the registry"""
        if name in self.connectors:
            del self.connectors[name]
            if name in self.connector_metadata:
                del self.connector_metadata[name]
            return True
        return False
    
    def get_connector_status(self, name):
        """Get the status and metadata of a specific connector"""
        if name not in self.connectors:
            return None
        return self.connector_metadata.get(name, {})
