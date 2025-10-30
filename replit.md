# Pipeline Health Monitor

## Overview

This is a real-time revenue operations monitoring application that integrates CRM data (Salesforce), customer health metrics (Supabase/PostgreSQL), and user engagement data (MongoDB) through a unified interface. The application provides workflow-based analytics for CRM integrity validation (BANT framework) and pipeline health monitoring, with built-in alerting capabilities via Slack.

The system uses a Data Connectivity Layer (DCL) architecture that acts as a router and abstraction layer, allowing workflows to query different data sources without knowing the underlying connection details or query languages. This creates a clean separation between data access and business logic.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 30, 2025 - Complete Feature Restoration (Dashboard & Operations)**
- **Dashboard (Pipeline Health)**: Restored full feature parity with Streamlit version
  - Added Risk Analysis charts: Health vs Risk scatter plot and Risk Score Distribution histogram
  - Added missing metrics: High Risk Deals and Avg Risk Score (now 8 total metrics)
  - Implemented Alert Management system with Slack integration for high-risk deals
  - Added interactive filtering: "Show stalled deals only" checkbox and risk score slider (0-100)
  - Enhanced opportunities table with "Is Stalled" badges and 7 total columns
  - All charts use Recharts with autonomOS dark theme (#0A2540 background)
- **Operations (CRM Integrity)**: Restored full feature parity with Streamlit version
  - Added Validation Analysis charts: Risk Level Distribution pie chart and Validation Status by Stage stacked bar
  - Fixed metrics: Total Opportunities, Valid Opportunities (with % badge), High Risk (replaced "Invalid")
  - Implemented Risk Level filter with multiselect checkboxes (HIGH, MEDIUM, LOW)
  - Enhanced validation table with 7 columns: Account Name, Amount, Risk Level badges, etc.
  - Added Human-in-the-Loop Escalation section with Slack alert integration
  - Implemented expandable escalation cards showing issues and action required
  - Updated backend to include risk_level, account_name, and amount in validation results
- Both pages now have 100% feature completeness compared to original Streamlit implementation
- All interactive features tested and verified via end-to-end Playwright tests

**October 30, 2025 - Frontend Migration to React**
- Migrated from Streamlit to modern React 19 + Vite 7 + TypeScript stack
- Created complete React component library (Navbar, Card, MetricCard, LoadingSpinner)
- Implemented three main pages: Dashboard, Operations, Connectivity
- Upgraded to Tailwind CSS v4 with CSS-based @theme configuration
- Fixed Vite 7 allowedHosts configuration for Replit deployment (`.replit.dev`, `.repl.co`)
- Configured FastAPI backend on port 8000 with workflow endpoints
- Configured Vite development server on port 5000 with API proxy
- Updated PostCSS to use `@tailwindcss/postcss` plugin for v4 compatibility
- Applied autonomOS design system across entire UI (black background, teal accents, enterprise blue cards)

## UI Design & Color Palette

**Design System: AutonomOS Platform Theme**

The application uses a dark, professional, and futuristic aesthetic with consistent teal accents matching the autonomOS platform design system.

**Primary Colors**
- **Teal/Cyan (Primary Accent)**: `#0BCAD9` - Icons, highlights, interactive elements, hover states, borders, active navigation items
- **Black (Main Background)**: `#000000` - Primary page background and navigation bar
- **Enterprise Data Blue**: `#0A2540` - Card backgrounds, chart backgrounds, metric containers
- **Blue Border**: `#1E4A6F` - Card borders, container outlines

**Text Colors**
- **Primary Text**: `#FFFFFF` - Headers, titles, main content
- **Secondary Text**: `#A0AEC0` - Subtitles, descriptions, labels
- **Accent Text**: `#0BCAD9` - Links, highlighted text, active states

**Visual Effects**
- **Glow Shadows**: Teal shadows with opacity (e.g., `0 0 12px rgba(11, 202, 217, 0.3)`) on active/hover states
- **Subtle Shadows**: Light teal shadows on cards (e.g., `0 4px 12px rgba(11, 202, 217, 0.1)`)
- **Hover Transitions**: All interactive elements use smooth transitions (`transition: all 0.2s ease`)
- **Border Highlights**: Interactive elements show teal borders on hover

**Navigation Design**
- Horizontal top navigation bar (no sidebar)
- Three main sections: Dashboard (Pipeline Health), Operations (CRM Integrity), Connectivity (DCL Demo)
- Active tab indicators with teal accent color and glow effect
- Sticky navigation with shadow for depth

**Layout Characteristics**
- Dark mode throughout
- Clean, spacious layouts with proper padding
- Minimalist design focused on data visualization
- Mobile-first responsive design principles
- Consistent use of teal accents to guide user attention to interactive elements

## System Architecture

### Core Architecture Pattern

**Data Connectivity Layer (DCL)**
- **Problem**: Applications need to query multiple data sources (Salesforce, PostgreSQL, MongoDB) with different query languages and connection patterns
- **Solution**: Unified connector registry pattern where data sources register query functions with the DCL core
- **Design**: `dcl_core.py` maintains a registry of named connectors, each providing a standardized `query()` interface
- **Benefits**: Workflows remain agnostic to data source implementation; connectors can be swapped or mocked without changing business logic

### Frontend Architecture

**React SPA** (`frontend/`)
- Modern single-page application built with React 19, Vite 7, and TypeScript
- Three main pages: Dashboard (Pipeline Health), Operations (CRM Integrity), Connectivity (DCL Demo)
- Component library: Navbar, Card, MetricCard, LoadingSpinner
- State management via React hooks (useState, useEffect, useMemo)
- Data fetching with custom useFetch hook and Axios
- Responsive design with Tailwind CSS v4 (CSS-based theme configuration)
- Interactive charts using Recharts library
- React Router v7 for client-side routing

**Legacy Streamlit Interface** (`app.py`) - Deprecated
- Original Streamlit dashboard remains for reference
- Replaced by modern React frontend for better performance and UX
- Session state management for DCL instance and connector initialization
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