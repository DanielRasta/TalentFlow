import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Opportunities from './pages/Opportunities';
import Candidates from './pages/Candidates';
import Matches from './pages/Matches';
import AiAssistant from './components/AiAssistant';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/matches" element={<Matches />} />
      </Routes>
      <AiAssistant />
    </Layout>
  );
}
