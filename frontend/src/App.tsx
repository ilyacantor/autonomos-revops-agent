import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { Operations } from '@/pages/Operations';
import { Connectivity } from '@/pages/Connectivity';
import { DebugTracePanel } from '@/components/DebugTracePanel';
import { initAosClientFromBackend } from './lib/aosClient';

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

function App() {
  useEffect(() => {
    if (USE_PLATFORM_VIEWS) {
      initAosClientFromBackend()
        .then((client) => {
          if (client) {
            console.log('[App] AosClient initialized from backend config');
          } else {
            console.warn('[App] Platform views enabled but backend config unavailable - will use mock data');
          }
        })
        .catch((error) => {
          console.error('[App] Error initializing AosClient:', error);
        });
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
