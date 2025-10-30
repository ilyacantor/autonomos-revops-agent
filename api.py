"""
FastAPI Backend for Pipeline Health Monitor
Exposes REST endpoints for workflows and DCL connectors
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime

from dcl_core import DCL
from connectors.salesforce_connector import create_salesforce_connector
from connectors.supabase_connector import create_supabase_connector
from connectors.mongo_connector import create_mongo_connector
from workflows.crm_integrity import CRMIntegrityWorkflow
from workflows.pipeline_health import PipelineHealthWorkflow

app = FastAPI(title="Pipeline Health Monitor API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global DCL instance
dcl = None

def get_dcl():
    """Get or initialize DCL instance"""
    global dcl
    if dcl is None:
        dcl = DCL()
        try:
            # Register Salesforce
            sf_connector, sf_meta = create_salesforce_connector()
            dcl.register_connector('salesforce', sf_connector, sf_meta)
            
            # Register Supabase
            sb_connector, sb_meta = create_supabase_connector()
            dcl.register_connector('supabase', sb_connector, sb_meta)
            
            # Register MongoDB
            mongo_result = create_mongo_connector()
            if len(mongo_result) == 3:
                mongo_connector, mongo_meta, _ = mongo_result
            else:
                mongo_connector, mongo_meta = mongo_result
            dcl.register_connector('mongodb', mongo_connector, mongo_meta)
            
            print("✅ All connectors initialized successfully")
        except Exception as e:
            print(f"⚠️ Error initializing connectors: {e}")
    return dcl

# Response models
class MetricResponse(BaseModel):
    label: str
    value: str
    change: Optional[str] = None
    trend: Optional[str] = None

class ConnectorInfo(BaseModel):
    name: str
    type: str
    status: str
    description: str

class OpportunityRecord(BaseModel):
    id: str
    name: str
    account_name: str
    stage: str
    amount: float
    health_score: int
    risk_score: int
    is_stalled: bool

class ValidationRecord(BaseModel):
    opportunity_id: str
    opportunity_name: str
    account_name: str
    stage: str
    amount: float
    is_valid: bool
    missing_fields: List[str]
    validation_issues: str
    risk_level: str

# Removed startup event - using lazy initialization instead

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Pipeline Health Monitor API"}

@app.get("/api/dcl/connectors", response_model=List[ConnectorInfo])
async def get_connectors():
    """Get list of registered DCL connectors"""
    dcl_instance = get_dcl()
    connectors = []
    for name, meta in dcl_instance.list_connectors().items():
        connectors.append(ConnectorInfo(
            name=name,
            type=meta.get('type', 'Unknown'),
            status=meta.get('status', 'Unknown'),
            description=meta.get('description', 'No description')
        ))
    return connectors

@app.post("/api/workflows/pipeline-health")
async def run_pipeline_health():
    """Execute pipeline health workflow and return metrics"""
    dcl_instance = get_dcl()
    try:
        workflow = PipelineHealthWorkflow(dcl_instance)
        df = workflow.run()
        
        if df is None or df.empty:
            raise HTTPException(status_code=500, detail="No data returned from workflow")
        
        # Get data quality report
        data_quality = workflow.get_data_quality_report()
        
        # Calculate metrics
        total_opps = len(df)
        at_risk = len(df[df['Risk Score'] >= 70]) if 'Risk Score' in df.columns else 0
        stalled = len(df[df['Is Stalled'] == True]) if 'Is Stalled' in df.columns else 0
        healthy = total_opps - at_risk - stalled
        
        total_value = df['Amount'].sum() if 'Amount' in df.columns else 0
        avg_health = df['Health Score'].mean() if 'Health Score' in df.columns else 0
        
        # Prepare metrics
        metrics = [
            MetricResponse(label="Total Opportunities", value=str(total_opps), trend="up"),
            MetricResponse(label="At Risk", value=str(at_risk), change=f"{(at_risk/total_opps*100):.1f}%" if total_opps > 0 else "0%"),
            MetricResponse(label="Healthy", value=str(healthy), change=f"{(healthy/total_opps*100):.1f}%" if total_opps > 0 else "0%"),
            MetricResponse(label="Stalled Deals", value=str(stalled)),
            MetricResponse(label="Pipeline Value", value=f"${total_value:,.0f}"),
            MetricResponse(label="Avg Health Score", value=f"{avg_health:.0f}")
        ]
        
        # Prepare opportunities
        opportunities = []
        for _, row in df.iterrows():
            opportunities.append(OpportunityRecord(
                id=row.get('Opportunity ID', ''),
                name=row.get('Opportunity Name', 'Unknown'),
                account_name=row.get('Account Name', 'Unknown'),
                stage=row.get('Stage', 'Unknown'),
                amount=float(row.get('Amount', 0)),
                health_score=int(row.get('Health Score', 0)),
                risk_score=int(row.get('Risk Score', 0)),
                is_stalled=bool(row.get('Is Stalled', False))
            ))
        
        return {
            "metrics": metrics,
            "opportunities": opportunities,
            "data_quality": {
                "health_data_available": data_quality['health_data_loaded'],
                "usage_data_available": data_quality['usage_data_loaded'],
                "warnings": data_quality['warnings']
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow error: {str(e)}")

@app.post("/api/workflows/crm-integrity")
async def run_crm_integrity():
    """Execute CRM integrity validation workflow"""
    dcl_instance = get_dcl()
    try:
        workflow = CRMIntegrityWorkflow(dcl_instance)
        df = workflow.run_validation()
        
        if df is None or df.empty:
            raise HTTPException(status_code=500, detail="No data returned from validation")
        
        # Calculate metrics
        total_opps = len(df)
        valid_opps = len(df[df['is_valid'] == True]) if 'is_valid' in df.columns else 0
        invalid_opps = total_opps - valid_opps
        validation_rate = (valid_opps / total_opps * 100) if total_opps > 0 else 0
        
        metrics = [
            MetricResponse(label="Total Records", value=str(total_opps)),
            MetricResponse(label="Valid", value=str(valid_opps), change=f"{validation_rate:.1f}%"),
            MetricResponse(label="Invalid", value=str(invalid_opps), change=f"{(100-validation_rate):.1f}%"),
        ]
        
        # Prepare validation records
        validations = []
        for _, row in df.iterrows():
            validations.append(ValidationRecord(
                opportunity_id=row.get('opportunity_id', ''),
                opportunity_name=row.get('opportunity_name', 'Unknown'),
                account_name=row.get('account_name', 'Unknown'),
                stage=row.get('stage', 'Unknown'),
                amount=float(row.get('amount', 0)),
                is_valid=bool(row.get('is_valid', False)),
                missing_fields=row.get('missing_fields', []),
                validation_issues=row.get('validation_issues', ''),
                risk_level=row.get('risk_level', 'MEDIUM')
            ))
        
        return {
            "metrics": metrics,
            "validations": validations,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Detailed health check with connector status"""
    dcl_instance = get_dcl()
    connector_status = {}
    for name, meta in dcl_instance.list_connectors().items():
        connector_status[name] = meta.get('status', 'Unknown')
    
    return {
        "status": "healthy",
        "connectors": connector_status,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
