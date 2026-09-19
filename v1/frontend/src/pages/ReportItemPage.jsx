import React, { useState } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  MapPin, 
  Calendar, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  X,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCategoryFallbackImage, getImageUrl } from '../utils/imageFallbacks';

const getLocalISOString = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
};

const CATEGORIES = [
  'Electronics',
  'Bags & Backpacks',
  'Keys',
  'IDs & Cards',
  'Clothing',
  'Books',
  'Eyewear',
  'Jewelry',
  'Other'
];

const CAMPUS_LOCATIONS = [
  'Main Library (Circulation / Stacks)',
  'Science Library & Study Commons',
  'Student Union & Food Court',
  'Engineering Hall & Labs',
  'Athletic Center / Rec Gym',
  'Dining Commons / Cafeteria',
  'North Campus Dormitories',
  'South Campus Residence Halls',
  'Campus Quad & Outdoor Grounds'
];

export const ReportItemPage = ({ defaultType = 'lost', onReportSuccess }) => {
  const { currentUser } = useAuth();

  const [type, setType] = useState(defaultType); // 'lost' or 'found'
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [location, setLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [customLocation, setCustomLocation] = useState('');
  const [dateTime, setDateTime] = useState(getLocalISOString());
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState(currentUser?.email || '');

  // Photo & Rekognition states
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [aiTags, setAiTags] = useState([]);
  const [detectedLabels, setDetectedLabels] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdItem, setCreatedItem] = useState(null);

  const isLost = type === 'lost';

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setError('');

    // Convert file to Base64 Data URL immediately so the exact image is never lost
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result;
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);

    setAnalyzingPhoto(true);

    try {
      // Send to backend which runs Amazon Rekognition DetectLabels and saves to /uploads
      const hint = `${title || file.name} ${category}`;
      const result = await api.uploadPhoto(file, hint);
      if (result && result.photoUrl) {
        setUploadedUrl(result.photoUrl);
      }
      if (result.ai_tags && result.ai_tags.length > 0) {
        setAiTags(result.ai_tags);
        setDetectedLabels(result.detected_labels || []);
      } else {
        // Run fallback semantic tag extraction on title/file name & category
        const tagRes = await api.analyzeRekognition(title || file.name, category, description);
        setAiTags(tagRes.ai_tags || []);
        setDetectedLabels(tagRes.detected_labels || []);
      }
    } catch (err) {
      console.warn('Rekognition analysis warning:', err);
      // Fallback to local semantic analysis if upload photo threw
      try {
        const tagRes = await api.analyzeRekognition(title || file.name, category, description);
        setAiTags(tagRes.ai_tags || []);
        setDetectedLabels(tagRes.detected_labels || []);
      } catch (e) {}
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleAutoExtractTags = async () => {
    setAnalyzingPhoto(true);
    try {
      const tagRes = await api.analyzeRekognition(title || 'Item', category, description);
      setAiTags(tagRes.ai_tags || []);
      setDetectedLabels(tagRes.detected_labels || []);
    } catch (err) {
      console.warn('Auto extract error:', err);
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (tag && !aiTags.includes(tag)) {
      setAiTags([...aiTags, tag]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setAiTags(aiTags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please provide a title for the item.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('Item title cannot exceed 100 characters.');
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > 1000) {
      setError('Description cannot exceed 1000 characters.');
      return;
    }

    // Check future date
    if (dateTime && new Date(dateTime) > new Date(Date.now() + 60000)) {
      setError('Incident date and time cannot be in the future.');
      return;
    }

    // Contact info format validation
    const contactClean = contactInfo.trim();
    if (!contactClean) {
      setError('Please provide contact information or custody drop-off location.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{3,6}$/;
    const isValidFormat = emailRegex.test(contactClean) || phoneRegex.test(contactClean.replace(/[\s\-\(\)\.]/g, ''));
    if (isLost && !isValidFormat) {
      setError('Please provide a valid contact email address (e.g. user@campus.edu) or phone number for the lost item.');
      return;
    }

    setSubmitting(true);

    const finalLocation = customLocation.trim() || location;

    // Prioritize uploaded permanent URL -> Base64 exact uploaded photo -> Category fallback only if no photo was uploaded
    const finalPhoto = uploadedUrl || photoDataUrl || (photoFile ? photoPreview : '') || getCategoryFallbackImage(category);

    // Ensure AI tags are never empty
    let finalAiTags = [...aiTags];
    let finalDetectedLabels = [...detectedLabels];
    if (finalAiTags.length === 0) {
      try {
        const autoTags = await api.analyzeRekognition(trimmedTitle, category, trimmedDesc);
        finalAiTags = autoTags.ai_tags || [];
        finalDetectedLabels = autoTags.detected_labels || [];
      } catch (err) {
        console.warn('Auto tags fallback on submit:', err);
      }
    }

    try {
      const payload = {
        title: trimmedTitle,
        type: type,
        category: category,
        location: finalLocation,
        dateTime: dateTime,
        description: trimmedDesc,
        photoUrl: finalPhoto,
        ai_tags: finalAiTags,
        detected_labels: finalDetectedLabels,
        contactInfo: contactClean,
        userId: currentUser?.id,
        userEmail: currentUser?.email
      };

      const res = await api.createItem(payload);
      setCreatedItem(res.item);
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  if (createdItem) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-5 animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">
            {isLost ? 'Lost Item Report Registered!' : 'Found Item Report Submitted!'}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Your report has been saved to Amazon DynamoDB and analyzed by Amazon Rekognition.
            Our AI matching engine has already scanned opposing reports.
          </p>
        </div>

        {/* Item preview card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left flex items-center gap-4 max-w-lg mx-auto shadow-sm">
          <img
            src={getImageUrl(createdItem.photoUrl, createdItem.category)}
            alt={createdItem.title}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getCategoryFallbackImage(createdItem.category);
            }}
            className="w-16 h-16 rounded-xl object-cover"
          />
          <div className="flex-1">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              isLost ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {createdItem.type}
            </span>
            <h4 className="font-bold text-sm text-slate-900 mt-1">{createdItem.title}</h4>
            <p className="text-xs text-slate-500">{createdItem.location}</p>
          </div>
        </div>


        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onReportSuccess('my-reports', createdItem)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Check AI Matches for this Report</span>
          </button>
          <button
            onClick={() => {
              setCreatedItem(null);
              setTitle('');
              setDescription('');
              setPhotoPreview('');
              setAiTags([]);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {isLost ? 'Report a Lost Item' : 'Report a Found Item'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Fill in the details below. Our AWS Rekognition vision model will auto-tag your photo for AI matching.
              </p>
            </div>

            {/* Type toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setType('lost')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  isLost ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lost
              </button>
              <button
                type="button"
                onClick={() => setType('found')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  !isLost ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Found
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Item Title / Name *
              </label>
              <span className={`text-[10px] font-medium ${title.length > 90 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                {title.length}/100
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Space Gray MacBook Air, Navy Kånken Backpack, Subaru Car Key"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none transition"
            />
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none bg-white transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Date & Time {isLost ? 'Last Seen' : 'Found'} *
              </label>
              <input
                type="datetime-local"
                required
                max={getLocalISOString()}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Cannot be in the future.
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Campus Location *
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none bg-white transition"
            >
              {CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Or specify exact room/area (e.g. '3rd floor study carrel #14')"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Detailed Description & Distinguishing Features
              </label>
              <span className={`text-[10px] font-medium ${description.length > 900 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                {description.length}/1000
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mention distinctive stickers, scratches, colors, contents, brand names, or specific markings..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none transition resize-none"
            />
          </div>

          {/* Photo Upload with Amazon Rekognition AI Auto-Tagging */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">

                  Item Photo & Amazon Rekognition Vision Auto-Tagging
                </span>
                <p className="text-[11px] text-slate-500">
                  Upload an image to auto-detect objects, labels, and colors for AI match calculation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoExtractTags}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition"
                  title="Run Amazon Rekognition extraction on current details"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Auto-Extract Tags</span>
                </button>
              </div>
            </div>


            {/* Upload Box */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {photoPreview ? (
                <div className="w-32 h-32 rounded-xl overflow-hidden relative border border-slate-300 shrink-0">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview('');
                      setPhotoFile(null);
                      setAiTags([]);
                      setDetectedLabels([]);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="w-full sm:w-48 h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition p-4 text-center">
                  <UploadCloud className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">Upload Photo</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG up to 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}

              <div className="flex-1 space-y-2 w-full">
                {analyzingPhoto ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold p-3 bg-blue-50/80 rounded-xl border border-blue-200">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Analyzing image with Amazon Rekognition DetectLabels...</span>
                  </div>
                ) : aiTags.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600">
                      Auto-Detected AI Labels (used for matching):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-blue-200 text-blue-700 shadow-2xs"
                        >
                          <Tag className="w-3 h-3 text-blue-500" />
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-500 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Upload a photo to see Amazon Rekognition automatically extract tags. Or add custom tags below.
                  </p>
                )}

                {/* Add Custom Tag Form */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Add custom tag (e.g. 'Blue', 'Sticker')..."
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 flex-1 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Custody Drop-off */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {isLost ? 'Your Contact Email / Phone' : 'Where is the item currently held?'} *
            </label>
            <input
              type="text"
              required
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder={isLost ? "alex.student@campus.edu or 555-0192" : "Turned in at Library Front Desk Lost & Found bin"}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none transition"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-2xl text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${
              isLost
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            } ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving to Amazon DynamoDB...</span>
              </>
            ) : (
              <>
                <span>Submit {isLost ? 'Lost Item Report' : 'Found Item Report'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
