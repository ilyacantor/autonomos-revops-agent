"""
Pipeline Health Monitor
Real-time revenue operations monitoring across CRM, customer health, and engagement data
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
    page_title="Pipeline Health Monitor",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Hide sidebar completely
st.markdown("""
<style>
    /* Hide sidebar entirely */
    [data-testid="stSidebar"] {
        display: none !important;
    }
    [data-testid="collapsedControl"] {
        display: none !important;
    }
    
    /* Horizontal navigation bar styling */
    .top-nav {
        background-color: #060D1A;
        padding: 0.75rem 2rem;
        border-bottom: 1px solid #1E4A6F;
        display: flex;
        align-items: center;
        gap: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 4px 12px rgba(11, 202, 217, 0.1);
    }
    
    .top-nav img {
        height: 30px;
        margin-right: 2rem;
    }
    
    .nav-tabs {
        display: flex;
        gap: 0.5rem;
        flex: 1;
    }
    
    .nav-tab {
        padding: 0.5rem 1.25rem;
        background: transparent;
        color: #A0AEC0;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.95rem;
        transition: all 0.2s ease;
    }
    
    .nav-tab:hover {
        background: rgba(11, 202, 217, 0.1);
        color: #0BCAD9;
        box-shadow: 0 0 8px rgba(11, 202, 217, 0.2);
    }
    
    .nav-tab-active {
        background: rgba(11, 202, 217, 0.15);
        color: #0BCAD9;
        font-weight: 600;
        box-shadow: 0 0 12px rgba(11, 202, 217, 0.3);
    }
    
    /* Remove default Streamlit padding */
    .block-container {
        padding-top: 1rem;
    }
</style>
""", unsafe_allow_html=True)

# --- Dynamic Schema Management Functions ---

def _get_unified_schema():
    """Returns the current state of the DCL's unified schema model."""
    if 'unified_schema' not in st.session_state:
        st.session_state.unified_schema = {
            'salesforce': ['Account_Name', 'Opportunity_ID', 'Stage', 'Value'],
            'supabase': ['Health_Score', 'sf_id'],
            'mongo': ['sf_account_id', 'page_views_last_week', 'last_login'], 
            'DCL_Unified_Model': ['Customer_ID', 'Name', 'Risk_Score', 'Pipeline_Value', 'Usage_Metric']
        }
    return st.session_state.unified_schema

def dynamic_schema_reset_mongo():
    """
    Simulates the DCL removing the MongoDB schema from the Unified Model
    after the connector is 'removed' by the user.
    """
    schema = _get_unified_schema()
    
    # Remove MongoDB's source fields
    schema['mongo'] = []
    
    # Update the Unified Model to remove dependencies
    if 'Usage_Metric' in schema['DCL_Unified_Model']:
        schema['DCL_Unified_Model'].remove('Usage_Metric')
        
    st.session_state.unified_schema = schema
    st.session_state.mongo_status = "removed"
    st.session_state.schema_update_message = "SUCCESS: MongoDB schema removed from DCL model."
    st.toast("MongoDB connector removed and schema successfully decoupled!", icon="❌")

def dynamic_schema_add_mongo():
    """
    Simulates the DCL dynamically introspecting the MongoDB schema and
    adding it to the Unified Model after the connector is 'registered'.
    """
    schema = _get_unified_schema()
    
    # Introspect and add the new fields
    new_mongo_fields = ['sf_account_id', 'page_views_last_week', 'last_login']
    schema['mongo'] = new_mongo_fields
    
    # Update the Unified Model
    if 'Usage_Metric' not in schema['DCL_Unified_Model']:
        schema['DCL_Unified_Model'].append('Usage_Metric')
    
    st.session_state.unified_schema = schema
    st.session_state.mongo_status = "active (simulated for demo)"
    st.session_state.schema_update_message = f"SUCCESS: MongoDB schema added with fields: {', '.join(new_mongo_fields)}"
    st.toast("MongoDB connector registered, schema normalized, and DCL model updated!", icon="✅")

def render_dynamic_schema_demo():
    """Renders the dedicated tab content for the dynamic schema demo."""
    st.title("Dynamic Schema Demo: Proving DCL Extensibility")
    st.subheader("Control the Data Mesh Live")
    
    st.markdown("""
    This interactive demo proves that the DCL can dynamically update its core logical model (schema)
    when a new connector is added or removed, preventing the entire platform from being a 'canned routine'.
    """)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### **Step 1: Disconnect** (Show Resilience)")
        if st.button("Delete MongoDB Connector (Simulated)", width='stretch', type="secondary"):
            dynamic_schema_reset_mongo()
            
    with col2:
        st.markdown("#### **Step 2: Reconnect** (Show Agility)")
        if st.button("Register MongoDB Connector (Simulated)", width='stretch', type="primary"):
            dynamic_schema_add_mongo()

    st.divider()
    
    # Visualization of Schema Changes
    schema = _get_unified_schema()
    
    st.markdown(f"### DCL Unified Data Model Status")
    st.info(f"Connector Status: **MongoDB is {st.session_state.get('mongo_status', 'Initialized')}**")
    
    st.markdown("#### Source Schemas")
    source_data = {
        'Salesforce': schema['salesforce'],
        'Supabase': schema['supabase'],
        'MongoDB (Product Logs)': schema['mongo']
    }
    st.json(source_data)
    
    st.markdown("#### Unified DCL Schema (The Layer Agents See)")
    st.code(schema['DCL_Unified_Model'])

    st.markdown(f"**Transaction Log:** *{st.session_state.get('schema_update_message', 'Awaiting instruction...')}*")

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

# Page render functions
def render_pipeline_health():
    """Render Pipeline Health Dashboard"""
    st.title("Pipeline Health Dashboard")
    st.markdown("Multi-source data join showing opportunities, health scores, and usage metrics")
    
    # Auto-run on first load
    if 'pipeline_data' not in st.session_state:
        with st.spinner("Loading pipeline data..."):
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
    
    # Refresh button in top right
    col_title, col_refresh = st.columns([6, 1])
    with col_refresh:
        if st.button("🔄 Refresh", key="refresh_pipeline", type="primary"):
            with st.spinner("Refreshing data..."):
                try:
                    if st.session_state.mongo_connector_obj:
                        sf_data = st.session_state.dcl.query('salesforce')
                        account_ids = list(set([opp.get('AccountId') for opp in sf_data if opp.get('AccountId')]))
                        st.session_state.mongo_connector_obj.populate_from_accounts(account_ids)
                    
                    workflow = PipelineHealthWorkflow(st.session_state.dcl)
                    pipeline_df = workflow.run()
                    st.session_state.pipeline_data = pipeline_df
                    metrics = workflow.get_summary_metrics()
                    st.session_state.pipeline_metrics = metrics
                    st.rerun()
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    # SECTION 1: Risk Analysis Charts (TOP)
    if 'pipeline_data' in st.session_state and not st.session_state.pipeline_data.empty:
        df = st.session_state.pipeline_data
        
        st.subheader("Risk Analysis")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Health vs Risk scatter
            fig = px.scatter(
                df,
                x='Health Score',
                y='Risk Score',
                size='Amount',
                color='Is Stalled',
                hover_data=['Opportunity Name', 'Stage'],
                title='Health Score vs Risk Score',
                color_discrete_map={True: '#FF6B6B', False: '#51CF66'},
                template='plotly_dark'
            )
            fig.update_layout(
                plot_bgcolor='#0A2540',
                paper_bgcolor='#0A2540',
                font_color='#FFFFFF'
            )
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Risk score distribution
            fig = px.histogram(
                df,
                x='Risk Score',
                nbins=20,
                title='Risk Score Distribution',
                color_discrete_sequence=['#FF6B6B'],
                template='plotly_dark'
            )
            fig.update_layout(
                plot_bgcolor='#0A2540',
                paper_bgcolor='#0A2540',
                font_color='#FFFFFF'
            )
            st.plotly_chart(fig, use_container_width=True)
    
    # SECTION 2: KPI Boxes
    if 'pipeline_metrics' in st.session_state:
        metrics = st.session_state.pipeline_metrics
        
        st.subheader("Key Metrics")
        col1, col2, col3, col4, col5, col6 = st.columns(6)
        with col1:
            st.metric("Total Opportunities", metrics.get('total_opportunities', 0))
        with col2:
            st.metric("Pipeline Value", f"${metrics.get('total_pipeline_value', 0):,.0f}")
        with col3:
            st.metric("Stalled Deals", metrics.get('stalled_deals', 0))
        with col4:
            st.metric("High Risk Deals", metrics.get('high_risk_deals', 0))
        with col5:
            st.metric("Avg Health Score", f"{metrics.get('avg_health_score', 0):.1f}")
        with col6:
            st.metric("Avg Risk Score", f"{metrics.get('avg_risk_score', 0):.1f}")
    
    # SECTION 3: Alert Management
    if 'pipeline_data' in st.session_state and not st.session_state.pipeline_data.empty:
        df = st.session_state.pipeline_data
        high_risk_deals = df[df['Risk Score'] > 70]
        
        st.subheader("Alert Management")
        if not high_risk_deals.empty:
            col1, col2 = st.columns([3, 1])
            with col1:
                st.warning(f"⚠️ {len(high_risk_deals)} high-risk deals detected (Risk Score > 70)")
            with col2:
                if st.button("📢 Send Slack Alerts", key="send_alerts_pipeline"):
                    alerter = SlackAlerter()
                    success_count = alerter.send_batch_alerts(
                        high_risk_deals.to_dict('records'),  # type: ignore
                        alert_type='pipeline'
                    )
                    st.success(f"✅ Sent {success_count} alerts to Slack")
        else:
            st.success("✅ No high-risk deals detected")
        
        # SECTION 4: Opportunities List with Controls
        st.subheader("Pipeline Opportunities")
        
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
            width='stretch',
            hide_index=True,
            column_config={
                "Amount": st.column_config.NumberColumn(
                    "Amount",
                    format="$%.2f"
                ),
                "Health Score": st.column_config.ProgressColumn(
                    "Health Score",
                    min_value=0,
                    max_value=100
                ),
                "Risk Score": st.column_config.ProgressColumn(
                    "Risk Score",
                    min_value=0,
                    max_value=100
                )
            }
        )

def render_crm_integrity():
    """Render CRM Integrity Dashboard"""
    st.title("CRM Integrity - BANT Validation")
    st.markdown("Stage gate enforcement with automated validation rules")
    
    # Auto-run on first load
    if 'validation_data' not in st.session_state:
        with st.spinner("Running BANT validation..."):
            try:
                workflow = CRMIntegrityWorkflow(st.session_state.dcl)
                validation_df = workflow.run_validation()
                st.session_state.validation_data = validation_df
                
                escalation_items = workflow.get_escalation_items()
                st.session_state.escalation_items = escalation_items
                
            except Exception as e:
                st.error(f"Error running CRM integrity workflow: {str(e)}")
    
    # Refresh button
    col_title, col_refresh = st.columns([6, 1])
    with col_refresh:
        if st.button("🔄 Refresh", key="run_bant", type="primary"):
            with st.spinner("Running BANT validation..."):
                try:
                    workflow = CRMIntegrityWorkflow(st.session_state.dcl)
                    validation_df = workflow.run_validation()
                    st.session_state.validation_data = validation_df
                    escalation_items = workflow.get_escalation_items()
                    st.session_state.escalation_items = escalation_items
                    st.rerun()
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    # SECTION 1: Graphs First
    if 'validation_data' in st.session_state and not st.session_state.validation_data.empty:
        df = st.session_state.validation_data
        
        st.subheader("Validation Analysis")
        col1, col2 = st.columns(2)
        
        with col1:
            # Risk level distribution
            risk_counts = df['risk_level'].value_counts()
            fig = px.pie(
                values=risk_counts.values,
                names=risk_counts.index,
                title='Risk Level Distribution',
                color=risk_counts.index,
                color_discrete_map={'HIGH': '#FF6B6B', 'MEDIUM': '#FFD93D', 'LOW': '#51CF66'},
                template='plotly_dark'
            )
            fig.update_layout(
                plot_bgcolor='#0A2540',
                paper_bgcolor='#0A2540',
                font_color='#FFFFFF'
            )
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Validation status by stage
            stage_validation = df.groupby('stage')['is_valid'].agg(['sum', 'count'])
            stage_validation['invalid'] = stage_validation['count'] - stage_validation['sum']  # type: ignore
            
            fig = go.Figure(data=[
                go.Bar(name='Valid', x=stage_validation.index, y=stage_validation['sum'], marker_color='#51CF66'),
                go.Bar(name='Invalid', x=stage_validation.index, y=stage_validation['invalid'], marker_color='#FF6B6B')
            ])
            fig.update_layout(
                title='Validation Status by Stage',
                barmode='stack',
                template='plotly_dark',
                plot_bgcolor='#0A2540',
                paper_bgcolor='#0A2540',
                font_color='#FFFFFF'
            )
            st.plotly_chart(fig, use_container_width=True)
        
        # SECTION 2: KPIs
        st.subheader("Key Metrics")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Opportunities", len(df))
        with col2:
            valid_count = df['is_valid'].sum()
            st.metric("Valid Opportunities", valid_count, delta=f"{valid_count/len(df)*100:.0f}%")
        with col3:
            high_risk = len(df[df['risk_level'] == 'HIGH'])
            st.metric("High Risk", high_risk, delta_color="inverse")
        
        # SECTION 3: Details
        st.subheader("Validation Details")
        
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
            width='stretch',
            hide_index=True
        )
        
        # Escalation alerts
        if 'escalation_items' in st.session_state and st.session_state.escalation_items:
            st.subheader("Human-in-the-Loop Escalation")
            
            col1, col2 = st.columns([3, 1])
            with col1:
                st.warning(f"⚠️ {len(st.session_state.escalation_items)} items require escalation")
            with col2:
                if st.button("📢 Send Slack Alerts", key="send_alerts_bant"):
                    alerter = SlackAlerter()
                    success_count = alerter.send_batch_alerts(
                        st.session_state.escalation_items,
                        alert_type='bant'
                    )
                    st.success(f"✅ Sent {success_count} escalation alerts to Slack")
            
            for item in st.session_state.escalation_items:
                with st.expander(f"🚨 {item['opportunity_name']} - {item['stage']}"):
                    st.write(f"**Issues:**")
                    for issue in item['issues']:
                        st.write(f"• {issue}")
                    st.write(f"**Action Required:** {item['action_required']}")

def render_data_explorer():
    """Render Data Explorer"""
    st.title("Data Source Explorer")
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
                    st.dataframe(result_df, width='stretch')
                    
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

def render_schema_mapping():
    """Render Schema Mapping"""
    st.title("Schema Normalization")
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
                    width='stretch',
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
    st.dataframe(schema_df, width='stretch', hide_index=True)

def render_connector_status():
    """Render Connector Status page"""
    st.title("Connector Status")
    st.markdown("Monitor and manage data source connections")
    
    connectors = st.session_state.dcl.get_registered_connectors()
    
    # Display connector cards
    st.subheader("Active Connectors")
    
    for conn in connectors:
        status_icon = "🟢" if conn['status'] == 'active' else "🔴"
        with st.expander(f"{status_icon} {conn['name']}", expanded=False):
            st.write(f"**Type:** {conn.get('type', 'Unknown')}")
            st.write(f"**Status:** {conn.get('status', 'Unknown')}")
            st.write(f"**Description:** {conn.get('description', 'N/A')}")
    
    if st.button("🔄 Refresh Connectors", type="primary"):
        st.session_state.connectors_initialized = False
        st.session_state.dcl = DCL()
        st.rerun()
    
    st.divider()
    
    # Dynamic connector registration
    st.subheader("➕ Add New Connector")
    
    new_connector_type = st.selectbox(
        "Connector Type",
        ["HubSpot", "Google Sheets", "Zendesk", "Custom API"]
    )
    
    if st.button("Register New Connector", type="primary"):
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

# Main app
def main():
    initialize_connectors()
    
    # Load custom CSS
    try:
        with open('.streamlit/style.css') as f:
            st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)
    except FileNotFoundError:
        pass
    
    # Initialize navigation state
    if 'current_page' not in st.session_state:
        st.session_state.current_page = 'Pipeline Health'
    
    # Text-based horizontal navigation
    st.markdown("""
    <style>
        .nav-menu {
            display: flex;
            gap: 2rem;
            padding: 1rem 0;
            border-bottom: 1px solid #1E4A6F;
            margin-bottom: 2rem;
        }
        .nav-item {
            color: #A0AEC0;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            padding: 0.5rem 1rem;
            transition: all 0.2s ease;
            border-bottom: 2px solid transparent;
        }
        .nav-item:hover {
            color: #0BCAD9;
            border-bottom-color: #0BCAD9;
        }
        .nav-item.active {
            color: #0BCAD9;
            border-bottom-color: #0BCAD9;
            font-weight: 600;
        }
        .submenu {
            display: flex;
            gap: 1.5rem;
            padding: 0.75rem 2rem;
            background: rgba(10, 37, 64, 0.5);
            margin-bottom: 1.5rem;
            border-radius: 8px;
        }
        .submenu-item {
            color: #A0AEC0;
            font-size: 0.9rem;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
        }
        .submenu-item:hover {
            color: #0BCAD9;
        }
        .submenu-item.active {
            color: #0BCAD9;
            font-weight: 600;
        }
    </style>
    """, unsafe_allow_html=True)
    
    # Main navigation
    col1, col2, col3, col4 = st.columns([2, 2, 2, 6])
    
    with col1:
        if st.button("Dashboard", key="nav_dashboard", use_container_width=True):
            st.session_state.current_page = 'Pipeline Health'
            st.session_state.show_operations_menu = False
            st.session_state.show_connectivity_menu = False
            if 'pipeline_data' in st.session_state:
                del st.session_state.pipeline_data
            st.rerun()
    
    with col2:
        if st.button("Operations", key="nav_operations", use_container_width=True):
            st.session_state.show_operations_menu = not st.session_state.get('show_operations_menu', False)
            st.session_state.show_connectivity_menu = False
    
    with col3:
        if st.button("Connectivity", key="nav_connectivity", use_container_width=True):
            st.session_state.show_connectivity_menu = not st.session_state.get('show_connectivity_menu', False)
            st.session_state.show_operations_menu = False
    
    # Operations submenu
    if st.session_state.get('show_operations_menu', False):
        cols = st.columns([1, 2, 2, 7])
        with cols[1]:
            if st.button("CRM Integrity", key="nav_crm", use_container_width=True):
                st.session_state.current_page = 'CRM Integrity'
                st.session_state.show_operations_menu = False
                if 'validation_data' in st.session_state:
                    del st.session_state.validation_data
                st.rerun()
        with cols[2]:
            if st.button("Data Explorer", key="nav_explorer", use_container_width=True):
                st.session_state.current_page = 'Data Explorer'
                st.session_state.show_operations_menu = False
                st.rerun()
    
    # Connectivity submenu
    if st.session_state.get('show_connectivity_menu', False):
        cols = st.columns([1, 2, 2, 2, 5])
        with cols[1]:
            if st.button("Schema Mapping", key="nav_schema", use_container_width=True):
                st.session_state.current_page = 'Schema Mapping'
                st.session_state.show_connectivity_menu = False
                st.rerun()
        with cols[2]:
            if st.button("Dynamic Schema", key="nav_dynamic", use_container_width=True):
                st.session_state.current_page = 'Dynamic Schema'
                st.session_state.show_connectivity_menu = False
                st.rerun()
        with cols[3]:
            if st.button("Connector Status", key="nav_connectors", use_container_width=True):
                st.session_state.current_page = 'Connector Status'
                st.session_state.show_connectivity_menu = False
                st.rerun()
    
    st.markdown("---")
    
    # Main content area - render based on current page
    if st.session_state.current_page == 'Pipeline Health':
        render_pipeline_health()
    elif st.session_state.current_page == 'CRM Integrity':
        render_crm_integrity()
    elif st.session_state.current_page == 'Data Explorer':
        render_data_explorer()
    elif st.session_state.current_page == 'Schema Mapping':
        render_schema_mapping()
    elif st.session_state.current_page == 'Dynamic Schema':
        render_dynamic_schema_demo()
    elif st.session_state.current_page == 'Connector Status':
        render_connector_status()

if __name__ == "__main__":
    main()
