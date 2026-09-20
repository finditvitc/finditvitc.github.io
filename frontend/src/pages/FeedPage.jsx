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
  HelpCircle,
  ChevronLeft,
  ChevronRight
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
  'AB1',
  'AB2',
  'AB3',
  'AB4',
  'AB5',
  'ADMIN BLOCK',
  'BASKETBALL COURT',
  'CRICKET GROUND',
  'FOOTBALL GROUND',
  'GAZEBO',
  'GYMKHANA',
  'GYMNASIUM',
  'KASTURBA AUDITORIUM',
  'LASSI HOUSE',
  'LIBRARY',
  'MG AUDITORIUM',
  'NETAJI AUDITORIUM',
  'NORTH SQUARE',
  'SWIMMING POOL',
  'VMART',
  'VOC AUDITORIUM',
  'VOLLEYBALL COURT'
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    setCurrentPage(1);
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
    setCurrentPage(1);
    loadItems();
  };

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const displayedItems = items.slice(startIndex, startIndex + pageSize);

  return (

    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-blue-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>AI-Assisted Lost &amp; Found Network</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-headline font-black tracking-tight leading-tight">
            Lost something on campus? FindIt VITC is here to help.
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-2 font-body leading-relaxed">
            Report lost items or turn in found valuables. Amazon Rekognition automatically tags images to find instant matches across the VIT Chennai campus.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-4 sm:mt-5">
            <button
              onClick={() => onNavigateReport('report-lost')}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-red-600/30 transition flex items-center gap-2 active:scale-95"
            >
              <span>Report Lost Item</span>
            </button>
            <button
              onClick={() => onNavigateReport('report-found')}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 active:scale-95"
            >
              <span>Report Found Item</span>
            </button>
          </div>
        </div>

        {/* Decorative background grid */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        {/* Row 1: Type Tabs + Search Bar + Refresh */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Lost / Found / All Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('lost')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'lost'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-200" />
              <span>Lost</span>
            </button>
            <button
              onClick={() => setActiveTab('found')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'found'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-200" />
              <span>Found</span>
            </button>
          </div>

          {/* Search Input & Refresh Button (Grouped on same row) */}
          <div className="flex items-center gap-2 flex-1 max-w-full md:max-w-md">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports, keywords, labels..."
                className="w-full pl-9 pr-20 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs outline-none transition bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition shadow-xs"
              >
                Search
              </button>
            </form>

            <button
              onClick={loadItems}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Category Horizontal Scroll & Location/Status Dropdowns */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Location & Status Filters (2 Columns on mobile, inline on desktop) */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto shrink-0">
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100 font-medium outline-none transition w-full"
            >
              <option value="All">All Locations</option>
              {LOCATIONS.filter(l => l !== 'All').map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100 font-medium outline-none transition w-full"
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
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fetching items from DynamoDB...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-center space-y-2">
          <p className="font-semibold text-sm">{error}</p>
          <button
            onClick={loadItems}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition"
          >
            Retry Connection
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3 shadow-xs">
          <Layers className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">
            No reports found matching criteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try resetting your filters or be the first to report this item on FindIt VITC!
          </p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('All');
              setLocation('All');
              setActiveTab('all');
              setStatusFilter('all');
            }}
            className="px-4 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 text-blue-700 dark:text-blue-300 font-semibold text-xs transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedItems.map((item) => {
              const isLost = item.type === 'lost';
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all flex flex-col group hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Image Container */}
                  <div 
                    className="h-48 w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden cursor-pointer"
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
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-sm ${
                        isLost ? 'bg-red-500' : 'bg-emerald-600'
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
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3 
                        onClick={() => onSelectItem(item)}
                        className="font-bold text-slate-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition line-clamp-1"
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-body">
                        {item.description || 'No detailed description provided.'}
                      </p>
                    </div>

                    {/* Location & Time */}
                    <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.dateTime ? new Date(item.dateTime).toLocaleDateString() : 'Recently'}</span>
                      </div>
                    </div>

                    {/* Amazon Rekognition AI Tags */}
                    {item.ai_tags && item.ai_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.ai_tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-semibold"
                          >
                            <Tag className="w-2.5 h-2.5" />
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
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => onSelectMatches(item)}
                        className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold text-xs transition"
                        title="Run AI match engine against opposing reports"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>AI Matches</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing <strong className="text-slate-800 dark:text-slate-200">{startIndex + 1}</strong>–
                <strong className="text-slate-800 dark:text-slate-200">{Math.min(startIndex + pageSize, items.length)}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200">{items.length}</strong> reports
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

