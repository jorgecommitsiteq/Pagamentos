/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Employees from './pages/Employees';
import Terms from './pages/Terms';
import Attendance from './pages/Attendance';
import Financial from './pages/Financial';
import Audit from './pages/Audit';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/app" element={<Layout />}>
          <Route path="employees" element={<Employees />} />
          <Route path="terms" element={<Terms />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="financial" element={<Financial />} />
          <Route path="audit" element={<Audit />} />
        </Route>
      </Routes>
    </Router>
  );
}
