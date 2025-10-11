/**
 * App Component - Minimal Version
 * 
 * Main application component with only essential routes.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { SignUp } from './pages/SignUp';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/sign-up" element={<SignUp />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;