"""
autonomOS DCL-light Demo Dashboard
Streamlit application demonstrating DCL architecture with real and mock connectors
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

# Import DCL core and connectors
from dcl_core import DCL
from connectors.salesforce_connector import create_salesforce_connector
from connectors.supabase_connector import create_supabase_connector
from connectors.mongo_connector import create_mongo_connector
from workflows.crm_integrity import CRMIntegrityWorkflow
from workflows.pipeline_health import PipelineHealthWorkflow
from utils.slack_alerts import SlackAlerter
from utils.schema_mapper import SchemaMapper

# Page configuration
st.set_page_config(
    page_title="autonomOS DCL-light Demo",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'dcl' not in st.session_state:
    st.session_state.dcl = DCL()
    st.session_state.mongo_connector_obj = None
    st.session_state.connectors_initialized = False

# Initialize DCL with connectors
def initialize_connectors():
    """Initialize all data connectors"""
    if st.session_state.connectors_initialized:
        return
    
    try:
        # Salesforce connector
        sf_query_fn, sf_metadata = create_salesforce_connector()
        st.session_state.dcl.register_connector('salesforce', sf_query_fn, sf_metadata)
        
        # Supabase connector
        sb_query_fn, sb_metadata = create_supabase_connector()
        st.session_state.dcl.register_connector('supabase', sb_query_fn, sb_metadata)
        
        # MongoDB mock connector
        mongo_query_fn, mongo_metadata, mongo_obj = create_mongo_connector()
        st.session_state.dcl.register_connector('mongo', mongo_query_fn, mongo_metadata)
        st.session_state.mongo_connector_obj = mongo_obj
        
        st.session_state.connectors_initialized = True
    except Exception as e:
        st.error(f"Error initializing connectors: {str(e)}")

# Main app
def main():
    initialize_connectors()
    
    # Header
    st.title("🤖 autonomOS DCL-light Demo")
    st.markdown("**Data Connectivity Layer** - Unified interface for multi-source data integration")
    
    # Sidebar - Connector Status Panel
    with st.sidebar:
        st.header("🔌 Connector Status")
        
        connectors = st.session_state.dcl.get_registered_connectors()
        
        for conn in connectors:
            status_icon = "🟢" if conn['status'] == 'active' else "🔴"
            with st.expander(f"{status_icon} {conn['name']}", expanded=False):
                st.write(f"**Type:** {conn.get('type', 'Unknown')}")
                st.write(f"**Status:** {conn.get('status', 'Unknown')}")
                st.write(f"**Description:** {conn.get('description', 'N/A')}")
        
        if st.button("🔄 Refresh Connectors"):
            st.session_state.connectors_initialized = False
            st.session_state.dcl = DCL()
            st.rerun()
        
        st.divider()
        
        # Dynamic connector registration
        st.header("➕ Add Connector")
        
        new_connector_type = st.selectbox(
            "Connector Type",
            ["HubSpot", "Google Sheets", "Zendesk", "Custom API"]
        )
        
        if st.button("Register New Connector"):
            # Demo: Register a mock connector
            def demo_connector(query_str=None, **kwargs):
                return [{"message": f"Data from {new_connector_type}"}]
            
            st.session_state.dcl.register_connector(
                new_connector_type.lower().replace(" ", "_"),
                demo_connector,
                {
                    "type": new_connector_type,
                    "status": "active",
                    "description": f"Dynamically registered {new_connector_type} connector"
                }
            )
            st.success(f"✅ {new_connector_type} connector registered!")
            st.rerun()
    
    # Main content tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 Pipeline Health",
        "✅ CRM Integrity",
        "🔗 Schema Mapping",
        "📈 Data Explorer"
    ])
    
    # Tab 1: Pipeline Health Workflow
    with tab1:
        st.header("Pipeline Health Dashboard")
        st.markdown("Multi-source data join showing opportunities, health scores, and usage metrics")
        
        if st.button("🔄 Refresh Pipeline Data", key="refresh_pipeline"):
            with st.spinner("Fetching data from all sources..."):
                try:
                    # Populate MongoDB with account IDs from Salesforce
                    if st.session_state.mongo_connector_obj:
                        sf_data = st.session_state.dcl.query('salesforce')
                        account_ids = list(set([opp.get('AccountId') for opp in sf_data if opp.get('AccountId')]))
                        st.session_state.mongo_connector_obj.populate_from_accounts(account_ids)
                    
                    workflow = PipelineHealthWorkflow(st.session_state.dcl)
                    pipeline_df = workflow.run()
                    st.session_state.pipeline_data = pipeline_df
                    
                    # Get summary metrics
                    metrics = workflow.get_summary_metrics()
                    st.session_state.pipeline_metrics = metrics
                    
                except Exception as e:
                    st.error(f"Error running pipeline workflow: {str(e)}")
        
        # Display metrics
        if 'pipeline_metrics' in st.session_state:
            metrics = st.session_state.pipeline_metrics
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Opportunities", metrics.get('total_opportunities', 0))
            with col2:
                st.metric("Pipeline Value", f"${metrics.get('total_pipeline_value', 0):,.0f}")
            with col3:
                st.metric("Stalled Deals", metrics.get('stalled_deals', 0))
            with col4:
                st.metric("High Risk Deals", metrics.get('high_risk_deals', 0))
            
            col5, col6 = st.columns(2)
            with col5:
                st.metric("Avg Health Score", f"{metrics.get('avg_health_score', 0):.1f}")
            with col6:
                st.metric("Avg Risk Score", f"{metrics.get('avg_risk_score', 0):.1f}")
        
        # Display pipeline data
        if 'pipeline_data' in st.session_state and not st.session_state.pipeline_data.empty:
            df = st.session_state.pipeline_data
            
            # Filters
            col1, col2 = st.columns(2)
            with col1:
                show_stalled_only = st.checkbox("Show stalled deals only", value=False)
            with col2:
                min_risk = st.slider("Minimum risk score", 0, 100, 0)
            
            # Apply filters
            filtered_df = df.copy()
            if show_stalled_only:
                filtered_df = filtered_df[filtered_df['Is Stalled'] == True]
            filtered_df = filtered_df[filtered_df['Risk Score'] >= min_risk]
            
            # Display table
            st.dataframe(
                filtered_df,
                use_container_width=True,
                hide_index=True
            )
            
            # Visualizations
            st.subheader("Risk Analysis")
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Risk score distribution
                fig = px.histogram(
                    df,
                    x='Risk Score',
                    nbins=20,
                    title='Risk Score Distribution',
                    color_discrete_sequence=['#FF6B6B']
                )
                st.plotly_chart(fig)
            
            with col2:
                # Health vs Risk scatter
                fig = px.scatter(
                    df,
                    x='Health Score',
                    y='Risk Score',
                    size='Amount',
                    color='Is Stalled',
                    hover_data=['Opportunity Name', 'Stage'],
                    title='Health Score vs Risk Score',
                    color_discrete_map={True: '#FF6B6B', False: '#51CF66'}
                )
                st.plotly_chart(fig)
            
            # Slack alerts
            st.subheader("Alert Management")
            high_risk_deals = df[df['Risk Score'] > 70]
            
            if not high_risk_deals.empty:
                st.warning(f"⚠️ {len(high_risk_deals)} high-risk deals detected")
                
                if st.button("📢 Send Slack Alerts for High-Risk Deals"):
                    alerter = SlackAlerter()
                    success_count = alerter.send_batch_alerts(
                        high_risk_deals.to_dict('records'),  # type: ignore
                        alert_type='pipeline'
                    )
                    st.success(f"✅ Sent {success_count} alerts to Slack")
    
    # Tab 2: CRM Integrity Workflow
    with tab2:
        st.header("CRM Integrity - BANT Validation")
        st.markdown("Stage gate enforcement with automated validation rules")
        
        if st.button("🔄 Run BANT Validation", key="run_bant"):
            with st.spinner("Validating opportunities against BANT criteria..."):
                try:
                    workflow = CRMIntegrityWorkflow(st.session_state.dcl)
                    validation_df = workflow.run_validation()
                    st.session_state.validation_data = validation_df
                    
                    escalation_items = workflow.get_escalation_items()
                    st.session_state.escalation_items = escalation_items
                    
                except Exception as e:
                    st.error(f"Error running CRM integrity workflow: {str(e)}")
        
        # Display validation results
        if 'validation_data' in st.session_state and not st.session_state.validation_data.empty:
            df = st.session_state.validation_data
            
            # Summary metrics
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Opportunities", len(df))
            with col2:
                valid_count = df['is_valid'].sum()
                st.metric("Valid Opportunities", valid_count, delta=f"{valid_count/len(df)*100:.0f}%")
            with col3:
                high_risk = len(df[df['risk_level'] == 'HIGH'])
                st.metric("High Risk", high_risk, delta_color="inverse")
            
            # Filters
            risk_filter = st.multiselect(
                "Filter by Risk Level",
                options=['HIGH', 'MEDIUM', 'LOW'],
                default=['HIGH', 'MEDIUM', 'LOW']
            )
            
            filtered_df = df[df['risk_level'].isin(risk_filter)]
            
            # Display validation table
            st.dataframe(
                filtered_df,
                use_container_width=True,
                hide_index=True
            )
            
            # Visualization
            col1, col2 = st.columns(2)
            
            with col1:
                # Risk level distribution
                risk_counts = df['risk_level'].value_counts()
                fig = px.pie(
                    values=risk_counts.values,
                    names=risk_counts.index,
                    title='Risk Level Distribution',
                    color=risk_counts.index,
                    color_discrete_map={'HIGH': '#FF6B6B', 'MEDIUM': '#FFD93D', 'LOW': '#51CF66'}
                )
                st.plotly_chart(fig)
            
            with col2:
                # Validation status by stage
                stage_validation = df.groupby('stage')['is_valid'].agg(['sum', 'count'])
                stage_validation['invalid'] = stage_validation['count'] - stage_validation['sum']  # type: ignore
                
                fig = go.Figure(data=[
                    go.Bar(name='Valid', x=stage_validation.index, y=stage_validation['sum'], marker_color='#51CF66'),
                    go.Bar(name='Invalid', x=stage_validation.index, y=stage_validation['invalid'], marker_color='#FF6B6B')
                ])
                fig.update_layout(title='Validation Status by Stage', barmode='stack')
                st.plotly_chart(fig)
            
            # Escalation alerts
            if 'escalation_items' in st.session_state and st.session_state.escalation_items:
                st.subheader("Human-in-the-Loop Escalation")
                st.warning(f"⚠️ {len(st.session_state.escalation_items)} items require escalation")
                
                for item in st.session_state.escalation_items:
                    with st.expander(f"🚨 {item['opportunity_name']} - {item['stage']}"):
                        st.write(f"**Issues:**")
                        for issue in item['issues']:
                            st.write(f"• {issue}")
                        st.write(f"**Action Required:** {item['action_required']}")
                
                if st.button("📢 Send Slack Escalation Alerts"):
                    alerter = SlackAlerter()
                    success_count = alerter.send_batch_alerts(
                        st.session_state.escalation_items,
                        alert_type='bant'
                    )
                    st.success(f"✅ Sent {success_count} escalation alerts to Slack")
    
    # Tab 3: Schema Mapping
    with tab3:
        st.header("Schema Normalization")
        st.markdown("Unified field mapping across heterogeneous data sources")
        
        mapper = SchemaMapper()
        
        # Display current mappings
        st.subheader("Current Schema Mappings")
        
        mappings = mapper.get_mapping_visualization()
        
        for source, entities in mappings.items():
            with st.expander(f"📦 {source.upper()} Mappings", expanded=True):
                for entity, fields in entities.items():
                    st.write(f"**{entity.capitalize()} Entity:**")
                    
                    mapping_df = pd.DataFrame(fields)
                    st.dataframe(
                        mapping_df,
                        use_container_width=True,
                        hide_index=True
                    )
        
        # Add custom mapping
        st.subheader("Add Custom Mapping")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            custom_source = st.selectbox(
                "Source System",
                ["salesforce", "supabase", "mongo", "new_source"]
            )
        
        with col2:
            custom_entity = st.selectbox(
                "Entity Type",
                ["opportunity", "account", "health", "usage", "custom"]
            )
        
        with col3:
            source_field = st.text_input("Source Field")
        
        with col4:
            target_field = st.text_input("Target Field")
        
        if st.button("Add Mapping"):
            if source_field and target_field:
                mapper.add_custom_mapping(custom_source, custom_entity, source_field, target_field)
                st.success(f"✅ Added mapping: {custom_source}.{source_field} → {target_field}")
            else:
                st.error("Please provide both source and target fields")
        
        # Visualization
        st.subheader("Unified Schema Structure")
        
        schema_data = []
        for entity, fields in mapper.unified_schema.items():
            for field, dtype in fields.items():
                schema_data.append({
                    'Entity': entity,
                    'Field': field,
                    'Type': dtype
                })
        
        schema_df = pd.DataFrame(schema_data)
        st.dataframe(schema_df, use_container_width=True, hide_index=True)
    
    # Tab 4: Data Explorer
    with tab4:
        st.header("Data Source Explorer")
        st.markdown("Direct query interface for registered connectors")
        
        connector_name = st.selectbox(
            "Select Connector",
            [conn['name'] for conn in st.session_state.dcl.get_registered_connectors()]
        )
        
        query_input = st.text_area(
            "Query (optional - leave blank for default)",
            help="Enter connector-specific query string"
        )
        
        if st.button("Execute Query"):
            with st.spinner(f"Querying {connector_name}..."):
                try:
                    result = st.session_state.dcl.query(
                        connector_name,
                        query_input if query_input else None
                    )
                    
                    st.subheader("Query Results")
                    
                    if isinstance(result, list) and result:
                        result_df = pd.DataFrame(result)
                        st.dataframe(result_df, use_container_width=True)
                        
                        # Download option
                        csv = result_df.to_csv(index=False)
                        st.download_button(
                            label="📥 Download as CSV",
                            data=csv,
                            file_name=f"{connector_name}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                            mime="text/csv"
                        )
                    elif isinstance(result, dict):
                        st.json(result)
                    else:
                        st.write(result)
                    
                except Exception as e:
                    st.error(f"Query error: {str(e)}")
        
        # Sample queries
        st.subheader("Sample Queries")
        
        sample_queries = {
            "salesforce": [
                ("All Open Opportunities", "SELECT Id, Name, StageName, Amount FROM Opportunity WHERE IsClosed = false"),
                ("High-Value Deals", "SELECT Id, Name, Amount FROM Opportunity WHERE Amount > 50000"),
                ("Recent Accounts", "SELECT Id, Name, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 10")
            ],
            "supabase": [
                ("All Health Scores", "table=customer_health"),
                ("Low Health Accounts", "table=customer_health (filter by score < 50)"),
            ],
            "mongo": [
                ("All Usage Data", ""),
                ("Inactive Users", "(last_login_days > 30)")
            ]
        }
        
        if connector_name in sample_queries:
            st.write(f"**Common queries for {connector_name}:**")
            for label, query in sample_queries[connector_name]:
                st.code(f"{label}: {query}", language="sql" if connector_name == "salesforce" else "text")

if __name__ == "__main__":
    main()
