import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { Operations } from '@/pages/Operations';
import { Connectivity } from '@/pages/Connectivity';

function App() {
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
      </div>
    </Router>
  );
}

export default App;
