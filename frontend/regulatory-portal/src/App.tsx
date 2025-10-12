import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AuditLogViewer from './components/audit/AuditLogViewer';
import MedicineDirectory from './components/medicine/MedicineDirectory';
import RecallManagement from './components/recall/RecallManagement';
import AdverseEventReporting from './components/adverseEvent/AdverseEventReporting';
import TenantManagement from './components/tenant/TenantManagement';
import UserManagement from './components/user/UserManagement';
import NotFoundPage from './pages/NotFoundPage';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    success: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    error: {
      main: '#d32f2f',
    },
    info: {
      main: '#0288d1',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="audit-logs" element={<AuditLogViewer />} />
            <Route path="medicines" element={<MedicineDirectory />} />
            <Route path="recalls" element={<RecallManagement />} />
            <Route path="adverse-events" element={<AdverseEventReporting />} />
            
            {/* Sprint 3 Routes */}
            <Route path="tenants" element={<TenantManagement />} />
            <Route path="users" element={<UserManagement />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;