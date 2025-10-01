"""
Schema Normalization Utility
Visual UI for unified field mapping across data sources
"""

import pandas as pd

class SchemaMapper:
    """
    Schema normalization layer for DCL
    Maps fields from different data sources to a unified schema
    """
    
    def __init__(self):
        # Define unified schema
        self.unified_schema = {
            'account': {
                'account_id': 'string',
                'account_name': 'string',
                'industry': 'string',
                'revenue': 'number',
                'employee_count': 'number'
            },
            'opportunity': {
                'opportunity_id': 'string',
                'opportunity_name': 'string',
                'account_id': 'string',
                'stage': 'string',
                'amount': 'number',
                'close_date': 'date',
                'probability': 'number'
            },
            'health': {
                'account_id': 'string',
                'health_score': 'number',
                'last_updated': 'date'
            },
            'usage': {
                'account_id': 'string',
                'last_login_days': 'number',
                'sessions_30d': 'number',
                'features_used': 'array'
            }
        }
        
        # Define source mappings
        self.source_mappings = {
            'salesforce': {
                'opportunity': {
                    'Id': 'opportunity_id',
                    'Name': 'opportunity_name',
                    'AccountId': 'account_id',
                    'StageName': 'stage',
                    'Amount': 'amount',
                    'CloseDate': 'close_date',
                    'Probability': 'probability'
                },
                'account': {
                    'Id': 'account_id',
                    'Name': 'account_name',
                    'Industry': 'industry',
                    'AnnualRevenue': 'revenue',
                    'NumberOfEmployees': 'employee_count'
                }
            },
            'supabase': {
                'health': {
                    'account_id': 'account_id',
                    'health_score': 'health_score',
                    'last_updated': 'last_updated'
                }
            },
            'mongo': {
                'usage': {
                    'account_id': 'account_id',
                    'last_login_days': 'last_login_days',
                    'sessions_30d': 'sessions_30d',
                    'features_used': 'features_used'
                }
            }
        }
    
    def map_fields(self, data, source, entity_type):
        """
        Map source fields to unified schema
        
        Args:
            data (list): Source data
            source (str): Source system name
            entity_type (str): Entity type (account, opportunity, etc.)
            
        Returns:
            list: Mapped data with unified field names
        """
        if source not in self.source_mappings:
            return data
        
        if entity_type not in self.source_mappings[source]:
            return data
        
        mapping = self.source_mappings[source][entity_type]
        mapped_data = []
        
        for record in data:
            mapped_record = {}
            for source_field, target_field in mapping.items():
                if source_field in record:
                    mapped_record[target_field] = record[source_field]
            mapped_data.append(mapped_record)
        
        return mapped_data
    
    def get_mapping_visualization(self):
        """
        Get visualization data for schema mapping UI
        
        Returns:
            dict: Mapping information for visualization
        """
        visualization = {}
        
        for source, entities in self.source_mappings.items():
            visualization[source] = {}
            for entity, mappings in entities.items():
                visualization[source][entity] = [
                    {
                        'source_field': src,
                        'target_field': tgt,
                        'target_type': self.unified_schema.get(entity, {}).get(tgt, 'unknown')
                    }
                    for src, tgt in mappings.items()
                ]
        
        return visualization
    
    def add_custom_mapping(self, source, entity_type, source_field, target_field):
        """Add a custom field mapping"""
        if source not in self.source_mappings:
            self.source_mappings[source] = {}
        
        if entity_type not in self.source_mappings[source]:
            self.source_mappings[source][entity_type] = {}
        
        self.source_mappings[source][entity_type][source_field] = target_field
        
        return True
    
    def get_unmapped_fields(self, data, source, entity_type):
        """Identify fields that don't have mappings"""
        if not data:
            return []
        
        sample_record = data[0] if isinstance(data, list) else data
        all_fields = set(sample_record.keys())
        
        mapped_fields = set()
        if source in self.source_mappings and entity_type in self.source_mappings[source]:
            mapped_fields = set(self.source_mappings[source][entity_type].keys())
        
        return list(all_fields - mapped_fields)
