# autonomOS DCL-light Demo

## Overview

This is a demonstration application showcasing the Data Connectivity Layer (DCL) architecture - a unified abstraction for querying multiple heterogeneous data sources. The system integrates CRM data (Salesforce), customer health metrics (Supabase/PostgreSQL), and user engagement data (MongoDB) through a single interface. The application provides workflow-based analytics for CRM integrity validation (BANT framework) and pipeline health monitoring, with built-in alerting capabilities via Slack.

The DCL acts as a router and abstraction layer, allowing workflows to query different data sources without knowing the underlying connection details or query languages. This creates a clean separation between data access and business logic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern

**Data Connectivity Layer (DCL)**
- **Problem**: Applications need to query multiple data sources (Salesforce, PostgreSQL, MongoDB) with different query languages and connection patterns
- **Solution**: Unified connector registry pattern where data sources register query functions with the DCL core
- **Design**: `dcl_core.py` maintains a registry of named connectors, each providing a standardized `query()` interface
- **Benefits**: Workflows remain agnostic to data source implementation; connectors can be swapped or mocked without changing business logic

### Frontend Architecture

**Streamlit Dashboard** (`app.py`)
- Single-page application with wide layout configuration
- Session state management for DCL instance and connector initialization
- Interactive UI for workflow execution and results visualization
- Uses Plotly for data visualization (charts and graphs)

### Backend Architecture

**Connector Pattern**
- Each data source implements a connector class with a standardized query interface
- Connectors handle authentication, connection management, and error fallback
- Mock data fallback when external services are unavailable
- Connector factory functions return both query function and metadata

**Workflow Pattern**
- Business logic encapsulated in workflow classes
- Each workflow receives DCL instance as dependency
- Workflows orchestrate multi-source data queries and joins
- Two primary workflows:
  - `CRMIntegrityWorkflow`: BANT validation with stage-based rules
  - `PipelineHealthWorkflow`: Multi-source data joining for pipeline analysis

### Data Storage Solutions

**Multi-source Strategy**
- **Salesforce (CRM)**: Primary source for opportunity and account data
  - SOQL queries for structured CRM data
  - Sandbox environment support via domain configuration
- **Supabase/PostgreSQL**: Customer health scoring system
  - `customer_health` table with account_id, health_score, and metadata
  - Indexed for fast lookups by account_id
- **MongoDB (Mock)**: User engagement and usage analytics
  - In-memory mock implementation for demonstration
  - Tracks login patterns, session data, and feature usage

### Authentication & Authorization

**Environment-based Credentials**
- Salesforce: Username, password, security token, and domain configuration
- Supabase: URL and API key authentication
- Slack: Webhook URL for alerting
- No user authentication implemented (demo application)

### Design Patterns

**Registry Pattern** (DCL Core)
- Central registry maintains connector name → query function mappings
- Metadata stored alongside connectors for introspection
- Runtime connector registration during initialization

**Factory Pattern** (Connectors)
- `create_salesforce_connector()`, `create_supabase_connector()` factory functions
- Returns tuple of (query_function, metadata_dict)
- Encapsulates connection logic and error handling

**Strategy Pattern** (Schema Mapping)
- `SchemaMapper` utility provides field mapping between data sources
- Unified schema definitions for account, opportunity, health, and usage entities
- Source-specific mappings translate native fields to unified schema

**Graceful Degradation**
- All connectors implement mock data fallback
- Application remains functional when external services unavailable
- Error messages logged but don't crash workflows

## External Dependencies

### Third-party Services

**Salesforce API**
- Integration: `simple-salesforce` Python library
- Purpose: CRM data source for opportunities and accounts
- Authentication: Username/password with security token
- Environment: Sandbox support (domain='test')

**Supabase PostgreSQL**
- Integration: `supabase-py` client library
- Purpose: Customer health score storage and retrieval
- Schema: `customer_health` table with indexed account_id lookups
- Authentication: URL + API key

**Slack Webhooks**
- Integration: Direct HTTP POST requests
- Purpose: Human-in-the-loop escalation alerts
- Configuration: Webhook URL via environment variable
- Format: JSON payload with message formatting

### Key Python Libraries

- **streamlit**: Web application framework and UI
- **pandas**: Data manipulation and DataFrame operations
- **plotly**: Interactive data visualization (express and graph_objects)
- **simple-salesforce**: Salesforce API client
- **supabase**: PostgreSQL database client for Supabase
- **requests**: HTTP client for Slack webhook calls

### Database Schema

**Supabase `customer_health` table**:
- `id`: BIGSERIAL primary key
- `account_id`: TEXT unique, indexed (foreign key to Salesforce Account.Id)
- `health_score`: INTEGER with check constraint (0-100)
- `details`: TEXT for contextual information
- `last_updated`: TIMESTAMP with automatic NOW() default

### Configuration Requirements

Required environment variables:
- `SALESFORCE_USERNAME`: Salesforce login username
- `SALESFORCE_PASSWORD`: Salesforce login password
- `SALESFORCE_SECURITY_TOKEN`: Salesforce security token
- `SALESFORCE_DOMAIN`: 'test' for sandbox, 'login' for production
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase API key (anon or service role)
- `SLACK_WEBHOOK_URL`: Incoming webhook URL for alerts (optional)