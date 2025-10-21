# Supabase Database Setup

## Quick Setup Instructions

To complete the Pipeline Health Monitor setup, you need to create the `customer_health` table in your Supabase database.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Create the Table

Copy and paste this SQL into the editor and click "Run":

```sql
CREATE TABLE IF NOT EXISTS customer_health (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT UNIQUE NOT NULL,
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    details TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_health_account_id ON customer_health(account_id);
```

### Step 3: Seed Sample Data

After creating the table, run this SQL to add sample health scores:

```sql
INSERT INTO customer_health (account_id, health_score, details) VALUES
    ('0015g00000XYZ1QAAX', 85, 'High engagement, active usage'),
    ('0015g00000ABC2QAAX', 45, 'Low activity, needs attention'),
    ('0015g00000DEF3QAAX', 92, 'Excellent health, power user'),
    ('0015g00000GHI4QAAX', 38, 'At risk, declining usage'),
    ('0015g00000JKL5QAAX', 67, 'Moderate engagement'),
    ('0015g00000MNO6QAAX', 78, 'Good health, steady usage'),
    ('0015g00000PQR7QAAX', 51, 'Average activity'),
    ('0015g00000STU8QAAX', 88, 'Strong engagement')
ON CONFLICT (account_id) DO UPDATE SET
    health_score = EXCLUDED.health_score,
    details = EXCLUDED.details,
    last_updated = NOW();
```

### Step 4: Match with Your Salesforce Account IDs

Once you run the Pipeline Health workflow, you'll see the actual Salesforce Account IDs. You can then update the sample data to match your real accounts:

```sql
-- Example: Update health scores to match your actual account IDs
UPDATE customer_health SET account_id = 'YOUR_REAL_ACCOUNT_ID' WHERE account_id = '0015g00000XYZ1QAAX';
```

Or insert new records for your accounts:

```sql
INSERT INTO customer_health (account_id, health_score, details) 
VALUES ('YOUR_ACCOUNT_ID', 75, 'Customer health details')
ON CONFLICT (account_id) DO UPDATE SET health_score = EXCLUDED.health_score;
```

### Alternative: Use Python Script

Once the table exists, you can run:

```bash
python setup_supabase.py
```

This will seed the sample data automatically.

## Verify Setup

1. Go to Supabase Table Editor
2. Select `customer_health` table
3. Verify the data is present

The Pipeline Health Monitor will now be able to fetch and display health scores!
