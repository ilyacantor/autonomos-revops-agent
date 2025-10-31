import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { Operations } from '@/pages/Operations';
import { Connectivity } from '@/pages/Connectivity';
import { DebugTracePanel } from '@/components/DebugTracePanel';
import { initAosClient } from './lib/aosClient';

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

function App() {
  useEffect(() => {
    if (USE_PLATFORM_VIEWS) {
      const baseUrl = import.meta.env.VITE_AOS_BASE_URL;
      const tenantId = import.meta.env.VITE_AOS_TENANT_ID;
      const agentId = import.meta.env.VITE_AOS_AGENT_ID;
      const jwt = import.meta.env.VITE_AOS_JWT;

      if (baseUrl && tenantId && agentId) {
        initAosClient({
          baseUrl,
          tenantId,
          agentId,
          jwt,
        });
        console.log('[App] AosClient initialized with platform views enabled');
      } else {
        console.warn('[App] Platform views enabled but configuration missing');
      }
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-dark-bg">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/connectivity" element={<Connectivity />} />
          </Routes>
        </main>
        <DebugTracePanel />
      </div>
    </Router>
  );
}

export default App;
