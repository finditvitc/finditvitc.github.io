import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  Tag, 
  Sparkles, 
  ArrowUpDown, 
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { getCategoryFallbackImage, getImageUrl } from '../utils/imageFallbacks';


const CATEGORIES = [
  'All',
  'Electronics',
  'Bags & Backpacks',
  'Keys',
  'IDs & Cards',
  'Clothing',
  'Books',
  'Other'
];

const LOCATIONS = [
  'All',
  'Library',
  'Student Center',
  'Science Quad',
  'Engineering Hall',
  'Athletic Center',
  'Dining Commons',
  'Dorms'
];

export const FeedPage = ({ onSelectItem, onSelectMatches, onNavigateReport, feedRefreshKey }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'lost', 'found'
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('All');
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => {
    loadItems();
  }, [activeTab, category, location, statusFilter, feedRefreshKey]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getItems({
        type: activeTab,
        category: category,
        location: location,
        status: statusFilter,
        search: search
      });
      setItems(data.items || []);
    } catch (err) {
      setError('Could not connect to API server. Please ensure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadItems();
  };

  const lostCount = items.filter(i => i.type === 'lost').length;
  const foundCount = items.filter(i => i.type === 'found').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Assisted Lost & Found Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Lost something on campus? We'll help you find it.
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Report lost items or turn in found valuables. Amazon Rekognition automatically tags images to find instant matches across campus.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => onNavigateReport('report-lost')}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wide shadow-lg shadow-red-600/30 transition flex items-center gap-2"
            >
              <span>Report Lost Item</span>
            </button>
            <button
              onClick={() => onNavigateReport('report-found')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
            >
              <span>Report Found Item</span>
            </button>
          </div>
        </div>

        {/* Decorative background grid */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Search Bar + Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Lost / Found / All Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('lost')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'lost'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span>Lost</span>
            </button>
            <button
              onClick={() => setActiveTab('found')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'found'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Found</span>
            </button>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports, keywords, or Rekognition labels..."
              className="w-full pl-9 pr-20 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs outline-none transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg transition"
            >
              Search
            </button>
          </form>

          {/* Refresh button */}
          <button
            onClick={loadItems}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition shrink-0"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Dropdowns & Category Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Category:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Location & Status Filters */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium outline-none"
            >
              <option value="All">All Locations</option>
              {LOCATIONS.filter(l => l !== 'All').map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Reports</option>
              <option value="claimed">Claimed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Fetching items from DynamoDB...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-2">
          <p className="font-semibold text-sm">{error}</p>
          <button
            onClick={loadItems}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition"
          >
            Retry Connection
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">No reports found matching criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try resetting your filters or be the first to report this item!
          </p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('All');
              setLocation('All');
              setActiveTab('all');
              setStatusFilter('all');
            }}
            className="px-4 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const isLost = item.type === 'lost';
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all flex flex-col group"
              >
                {/* Image Container */}
                <div 
                  className="h-48 w-full bg-slate-100 relative overflow-hidden cursor-pointer"
                  onClick={() => onSelectItem(item)}
                >
                  <img
                    src={getImageUrl(item.photoUrl, item.category)}
                    alt={item.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getCategoryFallbackImage(item.category);
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />


                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-sm ${
                      isLost ? 'bg-red-600' : 'bg-emerald-600'
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-white">
                      {item.category}
                    </span>
                  </div>

                  <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shadow-sm ${
                    item.status === 'open'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'claimed'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {item.status}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 
                      onClick={() => onSelectItem(item)}
                      className="font-bold text-slate-900 text-sm hover:text-blue-600 cursor-pointer transition line-clamp-1"
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description || 'No detailed description provided.'}
                    </p>
                  </div>

                  {/* Location & Time */}
                  <div className="space-y-1 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.dateTime ? new Date(item.dateTime).toLocaleDateString() : 'Recently'}</span>
                    </div>
                  </div>

                  {/* Amazon Rekognition AI Tags */}
                  {item.ai_tags && item.ai_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.ai_tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium"
                        >
                          <Tag className="w-2.5 h-2.5 text-blue-500" />
                          {tag}
                        </span>
                      ))}
                      {item.ai_tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-medium px-1">
                          +{item.ai_tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => onSelectItem(item)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => onSelectMatches(item)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition"
                      title="Run AI match engine against opposing reports"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>AI Matches</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
