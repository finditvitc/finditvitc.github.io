import React from 'react';
import { 
  X, 
  MapPin, 
  Calendar, 
  Tag, 
  Sparkles, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { getCategoryFallbackImage, getImageUrl } from '../utils/imageFallbacks';

export const ItemDetailsModal = ({ item, isOpen, onClose, onSelectMatches, onUpdateStatus }) => {
  if (!isOpen || !item) return null;

  const isLost = item.type === 'lost';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="relative">
          <div className="h-64 sm:h-72 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
            <img
              src={getImageUrl(item.photoUrl, item.category)}
              alt={item.title}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getCategoryFallbackImage(item.category);
              }}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            
            {/* Badges on image */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg text-white shadow-md ${
                isLost ? 'bg-red-600' : 'bg-emerald-600'
              }`}>
                {item.type} ITEM
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md text-white border border-white/20">
                {item.category}
              </span>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h2 className="text-xl sm:text-2xl font-black leading-tight">
                {item.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-white/90">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-300" />
                  {item.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.dateTime ? new Date(item.dateTime).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : 'Recently'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Description & Specific Details
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700">
              {item.description || 'No additional details provided.'}
            </p>
          </div>

          {/* Amazon Rekognition AI Auto-Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Amazon Rekognition Vision Labels
                </h4>
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                Extracted via AWS Computer Vision
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {item.ai_tags && item.ai_tags.length > 0 ? (
                item.ai_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800"
                  >
                    <Tag className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500 italic">No AI tags extracted.</span>
              )}
            </div>
          </div>

          {/* Contact / Custody Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
            <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isLost ? "Owner's Campus Contact" : "Item Drop-off Location / Custody"}:
              </span>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                {item.contactInfo || item.userEmail || "Campus Police Lost & Found Office"}
              </p>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Report Status:</span>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                item.status === 'open'
                  ? 'bg-emerald-100 text-emerald-800'
                  : item.status === 'claimed'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {item.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  onSelectMatches(item);
                  onClose();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>View AI Matches</span>
              </button>

              {onUpdateStatus && (
                <>
                  {item.status === 'open' && (
                    <button
                      onClick={() => onUpdateStatus(item.id, 'claimed')}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition"
                    >
                      Mark as Claimed
                    </button>
                  )}

                  {item.status === 'claimed' && (
                    <>
                      <button
                        onClick={() => onUpdateStatus(item.id, 'resolved')}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
                      >
                        Mark as Resolved
                      </button>
                      <button
                        onClick={() => onUpdateStatus(item.id, 'open')}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                      >
                        Reopen Report
                      </button>
                    </>
                  )}

                  {item.status === 'resolved' && (
                    <button
                      onClick={() => onUpdateStatus(item.id, 'open')}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                    >
                      Reopen Report
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
