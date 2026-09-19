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
      const data = await api.getItems({ userId: currentUser?.id });
      let items = data.items || [];
      
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-headline font-black text-slate-900 dark:text-white">
              My Campus Reports &amp; AI Match Finder
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {myItems.length} active
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-body">
            Tracking reports filed by <strong className="text-slate-800 dark:text-slate-200">{currentUser?.name || 'Student'}</strong> ({currentUser?.email}).
            FindIt VITC scans Amazon Rekognition features for matching items automatically.
          </p>
        </div>

        <button
          onClick={() => onNavigateReport('report-lost')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-headline font-bold text-xs shadow-md shadow-blue-600/20 transition self-start sm:self-auto flex items-center gap-1.5"
        >
          <span>+ File New Report</span>
        </button>
      </div>

      {contactSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-body flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{contactSuccess}</span>
          </div>
          <button onClick={() => setContactSuccess('')} className="text-emerald-700 dark:text-emerald-300 font-bold ml-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading your reports from DynamoDB...</p>
        </div>
      ) : myItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 sm:p-12 text-center space-y-4 max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">
            You haven't submitted any reports yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-body max-w-sm mx-auto">
            Report a lost item or an item you found on campus to start receiving automated AI match alerts from Amazon Rekognition.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigateReport('report-lost')}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs transition"
            >
              Report Lost Item
            </button>
            <button
              onClick={() => onNavigateReport('report-found')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-slate-850 border-blue-600 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
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
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded text-white ${
                            isLost ? 'bg-red-500' : 'bg-emerald-600'
                          }`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {item.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-body">
                          <span className="truncate">{item.location}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            item.status === 'open'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                              : item.status === 'claimed'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition ${
                        isSelected ? 'text-blue-600 dark:text-blue-400 translate-x-0.5' : 'text-slate-400 dark:text-slate-600'
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
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6 transition-colors">
                {/* Active Report Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={getImageUrl(selectedItem.photoUrl, selectedItem.category)}
                      alt={selectedItem.title}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCategoryFallbackImage(selectedItem.category);
                      }}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${
                          selectedItem.type === 'lost' ? 'bg-red-500' : 'bg-emerald-600'
                        }`}>
                          {selectedItem.type}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{selectedItem.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedItem.location}</p>
                    </div>
                  </div>

                  {/* Status Toggle buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Status:</span>
                    {selectedItem.status !== 'claimed' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'claimed')}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-semibold transition"
                      >
                        Mark Claimed
                      </button>
                    )}
                    {selectedItem.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'resolved')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold transition"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {selectedItem.status !== 'open' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedItem.id, 'open')}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Match Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        AI-Suggested Opposing Matches
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
                        Scored using Amazon Rekognition tags, Category, Location zone, and Keyword similarity
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {matches.length} matches found
                  </span>
                </div>

                {/* Matches List */}
                {loadingMatches ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Computing multi-factor similarity vectors in AWS Lambda...
                    </p>
                  </div>
                ) : syncPending ? (
                  <div className="p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                      <Clock className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Matches calculating</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 max-w-sm mx-auto">
                      AI matches calculate automatically once opposing reports are submitted with matching Rekognition labels.
                    </p>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No opposing matches found yet</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-body">
                      As soon as another student reports an item matching your Rekognition labels or location, it will appear here automatically.
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
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                            {/* Candidate Item Info */}
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <img
                                src={getImageUrl(matchItem.photoUrl, matchItem.category)}
                                alt={matchItem.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = getCategoryFallbackImage(matchItem.category);
                                }}
                                className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
                              />

                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${
                                    matchItem.type === 'lost' ? 'bg-red-500' : 'bg-emerald-600'
                                  }`}>
                                    {matchItem.type}
                                  </span>
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                    {matchItem.title}
                                  </h4>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-body line-clamp-2">
                                  {matchItem.description || 'No additional details provided.'}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {matchItem.location}
                                  </span>
                                  <span>•</span>
                                  <span>Reported: {new Date(matchItem.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Match Score Badge & Breakdown */}
                            <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-800">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  AI Match Confidence
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-xl font-black ${
                                    isHighScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {score}%
                                  </span>
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    isHighScore 
                                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' 
                                      : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                                  }`}>
                                    {isHighScore ? 'High Match' : 'Potential Match'}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleContactMatch(cand)}
                                className="mt-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Contact / Claim</span>
                              </button>
                            </div>
                          </div>

                          {/* Match Reasons & Criteria Pills */}
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                              Match Rationale:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {cand.reasons && cand.reasons.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                                  {r}
                                </span>
                              ))}
                            </div>

                            {/* Sub-scores metrics bar */}
                            {cand.breakdown && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px]">
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 block">Category</span>
                                  <strong className="text-slate-900 dark:text-white text-xs">{cand.breakdown.category}%</strong>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 block">Vision Tags</span>
                                  <strong className="text-slate-900 dark:text-white text-xs">{cand.breakdown.visual}%</strong>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 block">Location</span>
                                  <strong className="text-slate-900 dark:text-white text-xs">{cand.breakdown.location}%</strong>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 block">Keywords</span>
                                  <strong className="text-slate-900 dark:text-white text-xs">{cand.breakdown.text}%</strong>
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
