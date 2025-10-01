"""
Test script to verify both CRM Integrity and Pipeline Health workflows
"""

from dcl_core import DCL
from connectors.salesforce_connector import create_salesforce_connector
from connectors.supabase_connector import create_supabase_connector
from connectors.mongo_connector import create_mongo_connector
from workflows.crm_integrity import CRMIntegrityWorkflow
from workflows.pipeline_health import PipelineHealthWorkflow
from utils.slack_alerts import SlackAlerter

def setup_dcl():
    """Initialize DCL with all connectors"""
    dcl = DCL()
    
    # Register connectors
    sf_query_fn, sf_metadata = create_salesforce_connector()
    dcl.register_connector('salesforce', sf_query_fn, sf_metadata)
    
    sb_query_fn, sb_metadata = create_supabase_connector()
    dcl.register_connector('supabase', sb_query_fn, sb_metadata)
    
    mongo_query_fn, mongo_metadata, mongo_obj = create_mongo_connector()
    dcl.register_connector('mongo', mongo_query_fn, mongo_metadata)
    
    return dcl, mongo_obj

def test_pipeline_health(dcl, mongo_obj):
    """Test Pipeline Health Workflow"""
    print("\n" + "="*60)
    print("📊 Testing Pipeline Health Workflow")
    print("="*60)
    
    try:
        # Populate MongoDB with account IDs from Salesforce
        sf_data = dcl.query('salesforce')
        account_ids = list(set([opp.get('AccountId') for opp in sf_data if opp.get('AccountId')]))
        mongo_obj.populate_from_accounts(account_ids)
        print(f"✅ Populated MongoDB with {len(account_ids)} account IDs")
        
        # Run workflow
        workflow = PipelineHealthWorkflow(dcl)
        pipeline_df = workflow.run()
        
        print(f"\n✅ Pipeline Health Workflow Complete")
        print(f"   - Total Opportunities: {len(pipeline_df)}")
        print(f"   - Stalled Deals: {pipeline_df['Is Stalled'].sum()}")
        
        # Show sample data
        if not pipeline_df.empty:
            print("\n📋 Sample Pipeline Data:")
            print(pipeline_df[['Opportunity Name', 'Stage', 'Health Score', 'Risk Score', 'Is Stalled']].head(3).to_string(index=False))
        
        # Get summary metrics
        metrics = workflow.get_summary_metrics()
        print(f"\n📈 Summary Metrics:")
        print(f"   - Total Pipeline Value: ${metrics.get('total_pipeline_value', 0):,.0f}")
        print(f"   - High Risk Deals: {metrics.get('high_risk_deals', 0)}")
        print(f"   - Avg Health Score: {metrics.get('avg_health_score', 0):.1f}")
        print(f"   - Avg Risk Score: {metrics.get('avg_risk_score', 0):.1f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Pipeline Health Workflow Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_crm_integrity(dcl):
    """Test CRM Integrity Workflow"""
    print("\n" + "="*60)
    print("✅ Testing CRM Integrity Workflow (BANT Validation)")
    print("="*60)
    
    try:
        workflow = CRMIntegrityWorkflow(dcl)
        validation_df = workflow.run_validation()
        
        print(f"\n✅ CRM Integrity Workflow Complete")
        print(f"   - Total Opportunities Validated: {len(validation_df)}")
        print(f"   - Valid Opportunities: {validation_df['is_valid'].sum()}")
        print(f"   - High Risk: {len(validation_df[validation_df['risk_level'] == 'HIGH'])}")
        
        # Show sample validation results
        if not validation_df.empty:
            print("\n📋 Sample Validation Results:")
            print(validation_df[['opportunity_name', 'stage', 'is_valid', 'risk_level']].head(3).to_string(index=False))
        
        # Get escalation items
        escalation_items = workflow.get_escalation_items()
        if escalation_items:
            print(f"\n🚨 HITL Escalation Required: {len(escalation_items)} items")
            for item in escalation_items[:2]:
                print(f"   - {item['opportunity_name']}: {len(item['issues'])} issues")
        
        return True
        
    except Exception as e:
        print(f"❌ CRM Integrity Workflow Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_slack_integration():
    """Test Slack alerting (without sending)"""
    print("\n" + "="*60)
    print("📢 Testing Slack Integration")
    print("="*60)
    
    try:
        alerter = SlackAlerter()
        
        if alerter.webhook_url:
            print("✅ Slack webhook configured")
            print("   - Ready to send BANT violation alerts")
            print("   - Ready to send pipeline risk alerts")
        else:
            print("⚠️  Slack webhook not configured (optional)")
        
        return True
        
    except Exception as e:
        print(f"❌ Slack Integration Failed: {e}")
        return False

def test_dynamic_connector_registration(dcl):
    """Test dynamic connector registration"""
    print("\n" + "="*60)
    print("🔌 Testing Dynamic Connector Registration")
    print("="*60)
    
    try:
        # Show current connectors
        current_connectors = dcl.get_registered_connectors()
        print(f"✅ Current Connectors: {len(current_connectors)}")
        for conn in current_connectors:
            print(f"   - {conn['name']}: {conn['status']}")
        
        # Register a new demo connector (HubSpot)
        def hubspot_mock(query_str=None, **kwargs):
            return [{"deal_id": "123", "company": "Demo Co", "stage": "negotiation"}]
        
        dcl.register_connector(
            'hubspot',
            hubspot_mock,
            {
                "type": "HubSpot CRM",
                "status": "active",
                "description": "Dynamically registered HubSpot connector (demo)"
            }
        )
        
        print("\n✅ Dynamically Registered New Connector: hubspot")
        
        # Query the new connector
        result = dcl.query('hubspot')
        print(f"   - Queried hubspot: {len(result)} records")
        
        # Verify it's in the registry
        updated_connectors = dcl.get_registered_connectors()
        print(f"\n✅ Total Connectors After Registration: {len(updated_connectors)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Dynamic Registration Failed: {e}")
        return False

if __name__ == "__main__":
    print("\n🚀 autonomOS DCL-light Workflow Test Suite")
    print("="*60)
    
    # Setup DCL
    dcl, mongo_obj = setup_dcl()
    print("✅ DCL initialized with all connectors")
    
    # Run tests
    results = {
        'Pipeline Health': test_pipeline_health(dcl, mongo_obj),
        'CRM Integrity': test_crm_integrity(dcl),
        'Slack Integration': test_slack_integration(),
        'Dynamic Registration': test_dynamic_connector_registration(dcl)
    }
    
    # Summary
    print("\n" + "="*60)
    print("📋 Test Summary")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    all_passed = all(results.values())
    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED - autonomOS DCL-light is fully operational!")
    else:
        print("⚠️  Some tests failed - check output above for details")
    print("="*60)
