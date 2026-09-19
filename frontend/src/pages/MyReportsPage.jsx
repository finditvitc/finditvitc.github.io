import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Tag, 
  ExternalLink, 
  AlertCircle, 
  ChevronRight,
  ArrowLeft,
  Mail,
  HelpCircle,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCategoryFallbackImage, getImageUrl } from '../utils/imageFallbacks';


export const MyReportsPage = ({ initialSelectedItem = null, onNavigateReport }) => {
  const { currentUser } = useAuth();

  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(initialSelectedItem);

  // Match state
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');

  useEffect(() => {
    loadMyReports();
  }, [currentUser]);

  useEffect(() => {
    if (selectedItem) {
      loadMatches(selectedItem.id);
    }
  }, [selectedItem]);

  const loadMyReports = async () => {
    setLoading(true);
    try {
      // If user has specific ID, fetch their reports
      const data = await api.getItems({ userId: currentUser?.id });
      let items = data.items || [];
      
      // Also filter by email if items wasn't filtered by userId on backend
      if (currentUser?.email) {
        items = items.filter(
          i => i.userEmail === currentUser?.email || i.userId === currentUser?.id || i.userId === currentUser?.email
        );
      }

      setMyItems(items);
      if (!selectedItem && items.length > 0) {
        setSelectedItem(items[0]);
      }
    } catch (err) {
      console.warn('Notice fetching reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async (itemId) => {
    if (!itemId) {
      setMatches([]);
      setSyncPending(true);
      return;
    }
    setLoadingMatches(true);
    setSyncPending(false);
    setContactSuccess('');
    try {
      const data = await api.getItemMatches(itemId);
      if (data && data.status === 'pending_sync') {
        setSyncPending(true);
        setMatches([]);
      } else {
        setMatches(data?.matches || []);
      }
    } catch (err) {
      setSyncPending(true);
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleUpdateStatus = async (itemId, newStatus) => {
    try {
      await api.updateItemStatus(itemId, newStatus);
      setMyItems(myItems.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
      if (selectedItem?.id === itemId) {
        setSelectedItem({ ...selectedItem, status: newStatus });
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleContactMatch = (cand) => {
    const contact = cand.item.contactInfo || cand.item.userEmail || 'Campus Lost & Found Office';
    setContactSuccess(`Contact details for "${cand.item.title}": ${contact}. A notification ping was dispatched!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-headline font-black text-on-surface">My Campus Reports &amp; AI Match Finder</h1>
            <span className="text-xs font-label font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-primary">
              {myItems.length} active
            </span>
          </div>
          <p className="text-xs text-outline mt-1 font-body">
            Tracking reports filed by <strong>{currentUser?.name}</strong> ({currentUser?.email}).
            FindIt VITC scans Amazon Rekognition features for matching items automatically.
          </p>
        </div>

        <button
          onClick={() => onNavigateReport('report-lost')}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-headline font-semibold text-xs shadow-md shadow-primary/20 transition self-start sm:self-auto"
        >
          + File New Report
        </button>
      </div>

      {contactSuccess && (
        <div className="p-4 rounded-2xl bg-found-emerald/10 border border-found-emerald/30 text-xs text-found-emerald font-body flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-found-emerald shrink-0" />
            <span>{contactSuccess}</span>
          </div>
          <button onClick={() => setContactSuccess('')} className="text-found-emerald font-bold ml-2">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center space-y-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-outline">Loading your reports...</p>
        </div>
      ) : myItems.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/50 p-12 text-center space-y-4 max-w-lg mx-auto">
          <FileText className="w-12 h-12 text-outline-variant mx-auto" />
          <h3 className="font-headline font-bold text-on-surface text-base">You haven't submitted any reports yet</h3>
          <p className="text-xs text-outline font-body">
            Report a lost item or an item you found on campus to start receiving automated AI match alerts.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigateReport('report-lost')}
              className="px-4 py-2 rounded-xl bg-lost-coral text-white text-xs font-headline font-semibold shadow-xs"
            >
              Report Lost Item
            </button>
            <button
              onClick={() => onNavigateReport('report-found')}
              className="px-4 py-2 rounded-xl bg-found-emerald text-white text-xs font-headline font-semibold shadow-xs"
            >
              Report Found Item
            </button>
          </div>
        </div>
      ) : (
        /* Split view: Reports List on Left, Selected Report's Matches on Right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of My Reports (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-headline font-bold uppercase tracking-wider text-outline">
              Select a Report to View Matches
            </h3>

            <div className="space-y-2.5">
              {myItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isLost = item.type === 'lost';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-surface-container-lowest ${
                      isSelected
                        ? 'border-primary shadow-md ring-2 ring-primary-fixed'
                        : 'border-outline-variant/50 hover:border-outline-variant hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={getImageUrl(item.photoUrl, item.category)}
                        alt={item.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getCategoryFallbackImage(item.category);
                        }}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-label font-black uppercase px-1.5 py-0.2 rounded text-white ${
                            isLost ? 'bg-lost-coral' : 'bg-found-emerald'
                          }`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] text-outline truncate">
                            {item.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-headline font-bold text-on-surface truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-outline mt-1 font-body">
                          <span className="truncate">{item.location}</span>
                          <span className={`text-[10px] font-label font-semibold uppercase px-1.5 py-0.2 rounded ${
                            item.status === 'open'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition ${
                        isSelected ? 'text-primary translate-x-0.5' : 'text-outline-variant'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: AI Match Suggestions for Selected Report (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {selectedItem ? (
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/50 p-6 shadow-sm space-y-6">
                {/* Active Report Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container border border-outline-variant/40">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={getImageUrl(selectedItem.photoUrl, selectedItem.category)}
                      alt={selectedItem.title}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCategoryFallbackImage(selectedItem.category);
                      }}
                      className="w-14 h-14 rounded-xl object-cover"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-label font-black uppercase px-2 py-0.5 rounded text-white ${
                          selectedItem.type === 'lost' ? 'bg-lost-coral' : 'bg-found-emerald'
                        }`}>
                          {selectedItem.type}
                        </span>
                        <h3 className="font-headline font-bold text-sm text-on-surface">{selectedItem.title}</h3>
                      </div>
                      <p className="text-xs text-outline mt-0.5">{selectedItem.location}</p>
                    </div>
                  </div>

                  {/* Status Toggle buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[11px] text-outline mr-1">Status:</span>
                    {selectedItem.status !== 'claimed' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'claimed')}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition"
                      >
                        Mark Claimed
                      </button>
                    )}
                    {selectedItem.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'resolved')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {selectedItem.status !== 'open' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'open')}
                        className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-semibold transition"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Match Header */}
                <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-headline font-bold text-sm text-on-surface">
                        AI-Suggested Opposing Matches
                      </h4>
                      <p className="text-xs text-outline font-body">
                        Scored using Amazon Rekognition tags, Category, Location zone, and Keyword similarity
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-label font-bold px-2.5 py-1 rounded-full bg-primary-fixed text-primary border border-primary/20">
                    {matches.length} matches found
                  </span>
                </div>

                {/* Matches List */}
                {loadingMatches ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-outline font-medium">
                      Computing multi-factor similarity vectors in AWS Lambda...
                    </p>
                  </div>
                ) : syncPending ? (
                  <div className="p-8 rounded-2xl bg-amber-50/60 border border-amber-200 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                      <Clock className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-amber-900">Matches unavailable — item not yet synced</p>
                    <p className="text-[11px] text-amber-700 max-w-sm mx-auto">
                      This report was created locally or is pending synchronization with AWS DynamoDB. AI matches will calculate automatically once remote synchronization completes.
                    </p>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-surface-container border border-dashed border-outline-variant/60 text-center space-y-2">
                    <p className="text-xs font-semibold text-on-surface">No opposing matches found yet</p>
                    <p className="text-[11px] text-outline max-w-sm mx-auto font-body">
                      As soon as another student reports an item matching your Rekognition labels or location, it will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matches.map((cand, idx) => {
                      const matchItem = cand.item;
                      const score = cand.score;
                      const isHighScore = score >= 75;

                      return (
                        <div
                          key={matchItem.id || idx}
                          className={`p-5 rounded-2xl border transition-all ${
                            isHighScore
                              ? 'border-emerald-300 bg-gradient-to-br from-surface-container-lowest to-emerald-50/30 shadow-sm'
                              : 'border-outline-variant/50 bg-surface-container-lowest'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                            {/* Candidate Item Info */}
                            <div className="flex items-start gap-4 flex-1">
                              <img
                                src={getImageUrl(matchItem.photoUrl, matchItem.category)}
                                alt={matchItem.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = getCategoryFallbackImage(matchItem.category);
                                }}
                                className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-xs"
                              />

                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-label font-bold uppercase px-2 py-0.5 rounded text-white ${
                                    matchItem.type === 'lost' ? 'bg-lost-coral' : 'bg-found-emerald'
                                  }`}>
                                    {matchItem.type}
                                  </span>
                                  <h4 className="font-headline font-bold text-on-surface text-sm">
                                    {matchItem.title}
                                  </h4>
                                </div>

                                <p className="text-xs text-on-surface-variant leading-relaxed font-body">
                                  {matchItem.description}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-outline pt-1">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-outline" />
                                    {matchItem.location}
                                  </span>
                                  <span>•</span>
                                  <span>Reported: {new Date(matchItem.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Match Score Badge & Breakdown */}
                            <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-outline-variant/30">
                              <div>
                                <span className="text-[10px] font-label font-bold uppercase tracking-wider text-outline block">
                                  AI Match Confidence
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-xl font-headline font-black ${
                                    isHighScore ? 'text-found-emerald' : 'text-primary'
                                  }`}>
                                    {score}%
                                  </span>
                                  <span className={`text-[9px] font-label font-bold uppercase px-1.5 py-0.2 rounded ${
                                    isHighScore ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-fixed text-primary'
                                  }`}>
                                    {isHighScore ? 'High Match' : 'Potential Match'}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleContactMatch(cand)}
                                className="mt-2 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white font-headline font-semibold text-xs transition shadow-xs flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Contact / Claim</span>
                              </button>
                            </div>
                          </div>

                          {/* Match Reasons & Criteria Pills */}
                          <div className="mt-4 pt-3 border-t border-outline-variant/30 space-y-2">
                            <span className="text-[11px] font-headline font-bold text-on-surface block">
                              Match Rationale:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {cand.reasons && cand.reasons.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-container text-on-surface-variant"
                                >
                                  <CheckCircle className="w-3 h-3 text-found-emerald" />
                                  {r}
                                </span>
                              ))}
                            </div>

                            {/* Sub-scores metrics bar */}
                            {cand.breakdown && (
                              <div className="grid grid-cols-4 gap-2 pt-2 text-[10px] font-label">
                                <div className="p-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
                                  <span className="text-outline block">Category</span>
                                  <strong className="text-on-surface">{cand.breakdown.category}%</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
                                  <span className="text-outline block">Vision Tags</span>
                                  <strong className="text-on-surface">{cand.breakdown.visual}%</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
                                  <span className="text-outline block">Location</span>
                                  <strong className="text-on-surface">{cand.breakdown.location}%</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-surface-container border border-outline-variant/30">
                                  <span className="text-outline block">Keywords</span>
                                  <strong className="text-on-surface">{cand.breakdown.text}%</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
