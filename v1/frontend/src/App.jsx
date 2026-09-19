import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { AWSArchitectureModal } from './components/AWSArchitectureModal';
import { AuthModal } from './components/AuthModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { FeedPage } from './pages/FeedPage';
import { ReportItemPage } from './pages/ReportItemPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { AdminAlertPanel } from './pages/AdminAlertPanel';
import { LoginPage } from './pages/LoginPage';
import { Cloud, ShieldCheck, Heart } from 'lucide-react';
import { api } from './services/api';

function MainApp() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [selectedItemForMatches, setSelectedItemForMatches] = useState(null);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const handleSelectItem = (item) => {
    setSelectedItemForModal(item);
  };

  const handleSelectMatches = (item) => {
    setSelectedItemForMatches(item);
    setActiveTab('my-reports');
  };

  const handleReportSuccess = (targetTab, newItem) => {
    setSelectedItemForMatches(newItem);
    setFeedRefreshKey(Date.now());
    setActiveTab(targetTab || 'my-reports');
  };

  const handleUpdateStatus = async (itemId, newStatus) => {
    try {
      const res = await api.updateItemStatus(itemId, newStatus);
      const updated = res.item || { id: itemId, status: newStatus };
      if (selectedItemForModal && selectedItemForModal.id === itemId) {
        setSelectedItemForModal({ ...selectedItemForModal, ...updated, status: newStatus });
      }
      setFeedRefreshKey(Date.now());
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  // If user is not authenticated, display dedicated Landing & Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage onOpenArchitecture={() => setIsArchitectureModalOpen(true)} />
        <AWSArchitectureModal
          isOpen={isArchitectureModalOpen}
          onClose={() => setIsArchitectureModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Real-time Emergency Banner */}
      <EmergencyBanner />

      {/* Primary Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenArchitecture={() => setIsArchitectureModalOpen(true)}
      />

      {/* Main Screen Router */}
      <main className="flex-1 pb-16">
        {activeTab === 'feed' && (
          <FeedPage
            feedRefreshKey={feedRefreshKey}
            onSelectItem={handleSelectItem}
            onSelectMatches={handleSelectMatches}
            onNavigateReport={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'report-lost' && (
          <ReportItemPage
            key="lost"
            defaultType="lost"
            onReportSuccess={handleReportSuccess}
          />
        )}

        {activeTab === 'report-found' && (
          <ReportItemPage
            key="found"
            defaultType="found"
            onReportSuccess={handleReportSuccess}
          />
        )}

        {activeTab === 'my-reports' && (
          <MyReportsPage
            initialSelectedItem={selectedItemForMatches}
            onNavigateReport={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'admin-alerts' && (
          <AdminAlertPanel />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">CampusFind</span>
            <span>•</span>
            <span>College Lost & Found & Emergency Alert System</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsArchitectureModalOpen(true)}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>AWS Cloud Architecture</span>
            </button>
            <span>•</span>
            <span>S3 • Rekognition • Lambda • DynamoDB • SNS • Cognito</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ItemDetailsModal
        item={selectedItemForModal}
        isOpen={!!selectedItemForModal}
        onClose={() => setSelectedItemForModal(null)}
        onSelectMatches={handleSelectMatches}
        onUpdateStatus={handleUpdateStatus}
      />

      <AWSArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />

      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
