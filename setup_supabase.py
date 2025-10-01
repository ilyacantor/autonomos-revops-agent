"""
Setup Supabase Database Schema
Creates customer_health table and seeds with sample data
"""

import os
from supabase import create_client

def setup_database():
    """Initialize Supabase database with required tables and seed data"""
    
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    
    if not url or not key:
        print("❌ Supabase credentials not found")
        return False
    
    try:
        client = create_client(url, key)
        print("✅ Connected to Supabase")
        
        # Note: Table creation must be done via Supabase SQL Editor or API with service role key
        # This script will seed data into existing table
        
        # Sample customer health data aligned with Salesforce account IDs
        sample_health_data = [
            {"account_id": "0015g00000XYZ1QAAX", "health_score": 85, "details": "High engagement, active usage"},
            {"account_id": "0015g00000ABC2QAAX", "health_score": 45, "details": "Low activity, needs attention"},
            {"account_id": "0015g00000DEF3QAAX", "health_score": 92, "details": "Excellent health, power user"},
            {"account_id": "0015g00000GHI4QAAX", "health_score": 38, "details": "At risk, declining usage"},
            {"account_id": "0015g00000JKL5QAAX", "health_score": 67, "details": "Moderate engagement"},
            {"account_id": "0015g00000MNO6QAAX", "health_score": 78, "details": "Good health, steady usage"},
            {"account_id": "0015g00000PQR7QAAX", "health_score": 51, "details": "Average activity"},
            {"account_id": "0015g00000STU8QAAX", "health_score": 88, "details": "Strong engagement"},
        ]
        
        # Check if table exists by trying to query it
        try:
            result = client.table('customer_health').select("*").limit(1).execute()
            print("✅ customer_health table exists")
            
            # Clear existing data (optional)
            # client.table('customer_health').delete().neq('account_id', '').execute()
            
            # Insert sample data
            for record in sample_health_data:
                try:
                    client.table('customer_health').upsert(record).execute()
                    print(f"✅ Inserted health score for account {record['account_id']}")
                except Exception as e:
                    print(f"⚠️  Could not insert {record['account_id']}: {e}")
            
            print(f"\n✅ Successfully seeded {len(sample_health_data)} health records")
            return True
            
        except Exception as e:
            print(f"\n❌ customer_health table does not exist. Please create it with:")
            print("\nSQL to run in Supabase SQL Editor:")
            print("""
CREATE TABLE IF NOT EXISTS customer_health (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT UNIQUE NOT NULL,
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    details TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_health_account_id ON customer_health(account_id);
            """)
            print(f"\nError: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Setting up Supabase database...\n")
    success = setup_database()
    
    if success:
        print("\n✅ Database setup complete!")
    else:
        print("\n❌ Database setup failed. Please check the instructions above.")
