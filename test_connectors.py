"""
Test script to verify all connectors are working
"""

import os
from connectors.salesforce_connector import create_salesforce_connector
from connectors.supabase_connector import create_supabase_connector
from connectors.mongo_connector import create_mongo_connector

def test_salesforce():
    """Test Salesforce connection"""
    print("\n📊 Testing Salesforce Connector...")
    print(f"Username: {os.getenv('SALESFORCE_USERNAME', 'NOT_SET')[:20]}...")
    
    try:
        query_fn, metadata = create_salesforce_connector()
        print(f"Status: {metadata['status']}")
        
        if metadata['status'] == 'active':
            # Try to fetch opportunities
            data = query_fn()
            print(f"✅ Successfully fetched {len(data)} opportunities")
            if data:
                print(f"Sample: {data[0].get('Name', 'N/A')}")
            return True
        else:
            print("❌ Salesforce connector is disconnected")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_supabase():
    """Test Supabase connection"""
    print("\n🗄️  Testing Supabase Connector...")
    print(f"URL: {os.getenv('SUPABASE_URL', 'NOT_SET')[:30]}...")
    
    try:
        query_fn, metadata = create_supabase_connector()
        print(f"Status: {metadata['status']}")
        
        if metadata['status'] == 'active':
            # Try to fetch health data
            data = query_fn()
            print(f"✅ Successfully fetched {len(data)} health records")
            if data:
                print(f"Sample: Account {data[0].get('account_id', 'N/A')} - Score {data[0].get('health_score', 'N/A')}")
            return True
        else:
            print("❌ Supabase connector is disconnected")
            return False
            
    except Exception as e:
        print(f"⚠️  Error (table may not exist): {e}")
        return False

def test_mongo():
    """Test MongoDB mock connector"""
    print("\n📦 Testing MongoDB Mock Connector...")
    
    try:
        query_fn, metadata, connector_obj = create_mongo_connector()
        print(f"Status: {metadata['status']}")
        
        # Populate with sample data
        connector_obj.populate_from_accounts(['A100', 'A200', 'A300'])
        
        data = query_fn()
        print(f"✅ Mock data generated: {len(data)} accounts")
        if data:
            sample_key = list(data.keys())[0]
            print(f"Sample: Account {sample_key} - {data[sample_key]}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Testing autonomOS DCL Connectors\n" + "="*50)
    
    sf_ok = test_salesforce()
    sb_ok = test_supabase()
    mg_ok = test_mongo()
    
    print("\n" + "="*50)
    print("\n📋 Summary:")
    print(f"  Salesforce: {'✅ Connected' if sf_ok else '❌ Failed'}")
    print(f"  Supabase:   {'✅ Connected' if sb_ok else '⚠️  Table not created (see SUPABASE_SETUP.md)'}")
    print(f"  MongoDB:    {'✅ Working' if mg_ok else '❌ Failed'}")
    
    if not sb_ok:
        print("\n💡 Next step: Create the customer_health table in Supabase")
        print("   See SUPABASE_SETUP.md for instructions")
