import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/operations', label: 'Operations' },
  { path: '/connectivity', label: 'Connectivity' },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isLiveMode = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

  return (
    <nav className="sticky top-0 z-50 bg-card-bg border-b border-card-border shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-6 py-2 text-sm font-medium transition-all duration-200 relative ${
                    isActive 
                      ? 'text-teal-accent' 
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-accent shadow-lg shadow-teal-accent/50"></div>
                  )}
                </Link>
              );
            })}
          </div>
          
          <div className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide border ${
            isLiveMode 
              ? 'bg-green-500/20 text-green-400 border-green-500/50' 
              : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
          }`}>
            {isLiveMode ? 'LIVE' : 'DEMO'}
          </div>
        </div>
      </div>
    </nav>
  );
};
