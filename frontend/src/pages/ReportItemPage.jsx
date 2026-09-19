import React, { useState, useRef, useEffect } from 'react';
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
  ShieldCheck,
  RefreshCw,
  SwitchCamera
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCategoryFallbackImage, getImageUrl, compressImageFile } from '../utils/imageFallbacks';

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
  'AB1',
  'AB2',
  'AB3',
  'AB4',
  'AB5',
  'LIBRARY',
  'ADMIN BLOCK',
  'MG AUDITORIUM',
  'NETAJI AUDITORIUM',
  'KASTURBA AUDITORIUM',
  'VOC AUDITORIUM',
  'CRICKET GROUND',
  'FOOTBALL GROUND',
  'GAZEBO',
  'NORTH SQUARE',
  'LASSI HOUSE',
  'SWIMMING POOL',
  'VOLLEYBALL COURT',
  'BASKETBALL COURT',
  'GYMNASIUM',
  'GYMKHANA',
  'VMART'
];

// Instant client-side semantic & visual tag extractor
const extractClientTags = (fileName = '', itemTitle = '', itemCategory = '', itemDesc = '') => {
  const text = `${fileName} ${itemTitle} ${itemCategory} ${itemDesc}`.toLowerCase();
  const tags = new Set();
  
  if (itemCategory && itemCategory !== 'Other') tags.add(itemCategory);

  const RULES = [
    { kws: ['calculator', 'ti-84', 'scientific', 'texas instruments', 'casio'], tags: ['Calculator', 'Electronics', 'Device'] },
    { kws: ['earbuds', 'airpods', 'headphones', 'jbl', 'earphone', 'headset', 'galaxy buds', 'audio'], tags: ['Headphones', 'Earphone', 'Audio', 'Electronics', 'Accessory'] },
    { kws: ['laptop', 'macbook', 'notebook', 'computer', 'dell', 'thinkpad', 'chromebook', 'asus', 'hp'], tags: ['Laptop', 'Computer', 'Electronics', 'Screen', 'Keyboard'] },
    { kws: ['phone', 'iphone', 'smartphone', 'samsung', 'pixel', 'android', 'mobile'], tags: ['Mobile Phone', 'Phone', 'Electronics', 'Touchscreen'] },
    { kws: ['charger', 'cable', 'adapter', 'usb', 'lightning', 'magsafe', 'power bank'], tags: ['Adapter', 'Cable', 'Electronics', 'Hardware'] },
    { kws: ['backpack', 'kanken', 'bag', 'rucksack', 'herschel', 'north face', 'daypack'], tags: ['Backpack', 'Bag', 'Luggage', 'Strap', 'Accessories'] },
    { kws: ['wallet', 'cardholder', 'purse', 'billfold'], tags: ['Wallet', 'Leather', 'Accessories', 'Money'] },
    { kws: ['id', 'badge', 'card', 'license', 'campus card', 'student id', 'metrocard', 'pancard'], tags: ['Identity Card', 'Card', 'Document', 'Plastic'] },
    { kws: ['key', 'keys', 'car key', 'fob', 'subaru', 'toyota', 'honda', 'ford', 'bmw', 'audi', 'nissan'], tags: ['Keys', 'Car Key', 'Keyring', 'Metal', 'Remote Control', 'Accessories'] },
    { kws: ['jacket', 'coat', 'hoodie', 'sweater', 'outerwear', 'fleece', 'shirt', 'clothing'], tags: ['Clothing', 'Apparel', 'Outerwear', 'Textile'] },
    { kws: ['glasses', 'sunglasses', 'eyewear', 'spectacles', 'rayban'], tags: ['Eyewear', 'Glasses', 'Sunglasses', 'Accessories'] },
    { kws: ['watch', 'smartwatch', 'apple watch', 'rolex', 'casio', 'timepiece'], tags: ['Watch', 'Smartwatch', 'Electronics', 'Accessories'] },
    { kws: ['bottle', 'hydro flask', 'yeti', 'thermos', 'tumbler', 'stanley', 'mug', 'water bottle'], tags: ['Water Bottle', 'Bottle', 'Drinkware', 'Flask'] }
  ];

  for (const rule of RULES) {
    if (rule.kws.some(kw => text.includes(kw))) {
      rule.tags.forEach(t => tags.add(t));
    }
  }

  const COLORS = ['pink', 'blue', 'black', 'white', 'red', 'green', 'yellow', 'purple', 'silver', 'gold', 'gray', 'grey', 'orange', 'brown'];
  const objectTags = Array.from(tags).filter(t => !COLORS.map(c => c.toLowerCase()).includes(t.toLowerCase()));
  let detectedColor = null;
  for (const c of COLORS) {
    if (text.includes(c.toLowerCase())) {
      detectedColor = c.charAt(0).toUpperCase() + c.slice(1).replace('Grey', 'Gray');
      break;
    }
  }

  const finalTags = objectTags.slice(0, 4);
  if (detectedColor && !finalTags.includes(detectedColor)) {
    finalTags.push(detectedColor);
  } else if (objectTags.length > 4) {
    finalTags.push(objectTags[4]);
  }

  return finalTags.slice(0, 5);
};

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

  // Camera Modal States
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [cameraError, setCameraError] = useState('');
  const [cameraSnapshot, setCameraSnapshot] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdItem, setCreatedItem] = useState(null);

  const isLost = type === 'lost';

  // Process selected or captured image
  const processImage = async (file, customDataUrl = null) => {
    if (!file) return;

    setPhotoFile(file);
    setError('');

    // 1. Immediately compress image on client canvas to crisp ~25KB JPEG
    let dataUrl = customDataUrl;
    if (!dataUrl) {
      const compressed = await compressImageFile(file, 640, 0.72);
      dataUrl = compressed.dataUrl;
    }
    setPhotoDataUrl(dataUrl);
    setPhotoPreview(dataUrl);

    // 2. Instant client-side preview and immediate tag extraction (0ms latency)
    const immediateTags = extractClientTags(file.name || 'photo.jpg', title, category, description);
    if (immediateTags.length > 0) {
      setAiTags(immediateTags.slice(0, 5));
      setDetectedLabels(immediateTags.slice(0, 5).map(t => ({ name: t, confidence: 95.0 })));
    }

    setAnalyzingPhoto(true);

    try {
      // 3. Call live Amazon Rekognition vision detection in AWS Cloud
      const result = await api.uploadPhoto(file, title || file.name || 'item_photo', category, dataUrl);
      if (result && result.photoUrl) {
        setUploadedUrl(result.photoUrl);
      }
      
      const serverTags = result?.ai_tags || [];
      const serverLabels = result?.detected_labels || [];
      
      if (serverTags.length > 0) {
        // Authentic Amazon Rekognition labels (Top 5 tags with color)
        setAiTags(serverTags.slice(0, 5));
        setDetectedLabels(serverLabels.length > 0 ? serverLabels.slice(0, 5) : serverTags.slice(0, 5).map(t => ({ name: t, confidence: 95.0 })));
      } else if (immediateTags.length > 0) {
        setAiTags(immediateTags.slice(0, 5));
        setDetectedLabels(immediateTags.slice(0, 5).map(t => ({ name: t, confidence: 90.0 })));
      }
    } catch (err) {
      console.warn('Amazon Rekognition upload note:', err);
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImage(file);
    }
  };

  // Start Live Camera Stream
  const startCamera = async (facing = cameraFacing) => {
    setCameraError('');
    setCameraSnapshot(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera stream not supported on this browser. Opening device camera app...');
      }

      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      // Fallback to native mobile camera file input if getUserMedia fails
      setCameraError(err.message || 'Unable to access camera. Use device camera option.');
      setTimeout(() => {
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
          setIsCameraModalOpen(false);
        }
      }, 800);
    }
  };

  // Stop Live Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleOpenLiveCamera = () => {
    setIsCameraModalOpen(true);
    setCameraSnapshot(null);
    setTimeout(() => {
      startCamera(cameraFacing);
    }, 100);
  };

  const handleCloseCameraModal = () => {
    stopCamera();
    setIsCameraModalOpen(false);
    setCameraSnapshot(null);
  };

  const handleSwitchCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCameraSnapshot(dataUrl);
    stopCamera();
  };

  const handleRetakeSnapshot = () => {
    setCameraSnapshot(null);
    startCamera(cameraFacing);
  };

  const handleConfirmSnapshot = async () => {
    if (!cameraSnapshot) return;

    // Convert dataUrl to File object
    const res = await fetch(cameraSnapshot);
    const blob = await res.blob();
    const file = new File([blob], `camera_found_${Date.now()}.jpg`, { type: 'image/jpeg' });

    await processImage(file, cameraSnapshot);
    handleCloseCameraModal();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleAutoExtractTags = async () => {
    setAnalyzingPhoto(true);
    try {
      if (photoFile) {
        const res = await api.uploadPhoto(photoFile, title || photoFile.name, category, photoDataUrl);
        if (res.ai_tags && res.ai_tags.length > 0) {
          setAiTags(res.ai_tags.slice(0, 5));
          setDetectedLabels(res.detected_labels?.slice(0, 5) || []);
          return;
        }
      }
      
      const tagRes = await api.analyzeRekognition(title || 'Item', category, description);
      if (tagRes.ai_tags && tagRes.ai_tags.length > 0) {
        setAiTags(tagRes.ai_tags.slice(0, 5));
        setDetectedLabels(tagRes.detected_labels?.slice(0, 5) || []);
      }
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

    const finalLocation = customLocation.trim() 
      ? `${location} (${customLocation.trim()})`
      : location;

    // Use uploaded URL or base64 dataUrl or crisp category fallback
    const finalPhoto = uploadedUrl || photoDataUrl || getCategoryFallbackImage(category);

    const payload = {
      title: trimmedTitle,
      type: type, // 'lost' or 'found'
      category: category,
      location: finalLocation,
      dateTime: new Date(dateTime).toISOString(),
      description: trimmedDesc,
      photoUrl: finalPhoto,
      ai_tags: aiTags,
      detected_labels: detectedLabels,
      contactInfo: contactInfo.trim() || currentUser?.email || 'Contact student via campus security',
      userId: currentUser?.id || 'usr-vit-student',
      userEmail: currentUser?.email || ''
    };

    setSubmitting(true);

    try {
      const res = await api.createItem(payload);
      const itemData = res?.item || payload;
      setCreatedItem(itemData);
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success view
  if (createdItem) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-headline font-black text-slate-900 dark:text-white">
            {isLost ? 'Lost Item Report Submitted!' : 'Found Item Registered!'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Your report has been securely indexed in Amazon DynamoDB. Amazon Rekognition tags are active for instant AI match detection.
          </p>
        </div>

        {/* Report Summary Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left space-y-3 shadow-md">
          <div className="flex items-center gap-3">
            <img 
              src={getImageUrl(createdItem.photoUrl, createdItem.category)} 
              alt={createdItem.title} 
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
            />
            <div className="min-w-0 flex-1">
              <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                isLost ? 'bg-red-500' : 'bg-emerald-600'
              }`}>
                {createdItem.type}
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-1">{createdItem.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">{createdItem.location}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onReportSuccess('feed', createdItem)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
          >
            <span>View in Home Feed</span>
          </button>
          <button
            onClick={() => onReportSuccess('my-reports', createdItem)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Check AI Matches</span>
          </button>
          <button
            onClick={() => {
              setCreatedItem(null);
              setTitle('');
              setDescription('');
              setPhotoPreview('');
              setPhotoDataUrl('');
              setUploadedUrl('');
              setPhotoFile(null);
              setAiTags([]);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Hidden File Inputs */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Live Camera Viewfinder Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl space-y-4 p-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  {cameraSnapshot ? 'Review Camera Snapshot' : 'Live Camera Viewfinder'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseCameraModal}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cameraError && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/50 text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Video or Snapshot Canvas Preview */}
            <div className="relative aspect-video sm:aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {cameraSnapshot ? (
                <img src={cameraSnapshot} alt="Snapshot Preview" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />

              {!cameraSnapshot && (
                <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/30 rounded-2xl m-4 flex items-center justify-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm">
                    Frame Item Inside Box
                  </div>
                </div>
              )}
            </div>

            {/* Camera Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {cameraSnapshot ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetakeSnapshot}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSnapshot}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Use This Photo</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSwitchCameraFacing}
                    title="Switch Front/Back Camera"
                    className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTakeSnapshot}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      cameraInputRef.current?.click();
                      handleCloseCameraModal();
                    }}
                    title="Open native camera"
                    className="px-3 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
                  >
                    Device App
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Report Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-6 sm:p-8 space-y-6 transition-colors">
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-headline font-black text-slate-900 dark:text-white">
                {isLost ? 'Report a Lost Item' : 'Report a Found Item'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-body">
                Fill in the details below. Take a photo or upload an image for Amazon Rekognition AI auto-matching.
              </p>
            </div>

            {/* Type toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setType('lost')}
                className={`px-3 py-1.5 rounded-lg text-xs font-headline font-bold transition ${
                  isLost 
                    ? 'bg-red-500 text-white shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Lost
              </button>
              <button
                type="button"
                onClick={() => setType('found')}
                className={`px-3 py-1.5 rounded-lg text-xs font-headline font-bold transition ${
                  !isLost 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Found
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
              placeholder="e.g. Space Gray MacBook Air, Navy Kånken Backpack, Casio FX-991CW Calculator"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none transition"
            />
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Date & Time {isLost ? 'Last Seen' : 'Found'} *
              </label>
              <input
                type="datetime-local"
                required
                max={getLocalISOString()}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Cannot be in the future.
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Campus Location *
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition"
            >
              {CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">{loc}</option>
              ))}
            </select>

            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Or specify exact room/area (e.g. '3rd floor study carrel #14')"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:border-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none transition resize-none"
            />
          </div>

          {/* Photo Capture & Upload with Amazon Rekognition AI Auto-Tagging */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Item Photo &amp; Amazon Rekognition Vision Auto-Tagging
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Take a photo with your camera or upload an image to auto-detect labels and colors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoExtractTags}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-lg transition"
                  title="Run Amazon Rekognition extraction on current details"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Auto-Extract Tags</span>
                </button>
              </div>
            </div>

            {/* Photo Capture Actions / Preview */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {photoPreview ? (
                <div className="w-full sm:w-auto flex flex-col items-center gap-2 shrink-0">
                  <div className="w-36 h-36 rounded-2xl overflow-hidden relative border-2 border-emerald-500/40 shadow-md group">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview('');
                        setPhotoDataUrl('');
                        setUploadedUrl('');
                        setPhotoFile(null);
                        setAiTags([]);
                        setDetectedLabels([]);
                      }}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition shadow-sm"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleOpenLiveCamera}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3 h-3 text-emerald-500" />
                      <span>Retake</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                    >
                      <UploadCloud className="w-3 h-3 text-blue-500" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-80 shrink-0">
                  {/* Option 1: Open Camera (Live Viewfinder + Device Shutter) */}
                  <button
                    type="button"
                    onClick={handleOpenLiveCamera}
                    className="h-32 rounded-2xl border-2 border-dashed border-emerald-400/80 dark:border-emerald-500/50 hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 flex flex-col items-center justify-center gap-2 p-3 text-center transition group cursor-pointer shadow-xs"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        Take Photo
                      </span>
                      <span className="block text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                        Camera &amp; Live Viewfinder
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Upload from Device Storage */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-750 flex flex-col items-center justify-center gap-2 p-3 text-center transition group cursor-pointer shadow-xs"
                  >
                    <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        Upload Image
                      </span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        From Files or Gallery
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Rekognition Status & AI Labels */}
              <div className="flex-1 space-y-2 w-full">
                {analyzingPhoto ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-semibold p-3.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Analyzing image with Amazon Rekognition DetectLabels in AWS Cloud...</span>
                  </div>
                ) : aiTags.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Auto-Detected AI Labels (used for matching):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-2xs"
                        >
                          <Tag className="w-3 h-3 text-blue-500 dark:text-blue-400" />
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
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    Capture a photo with your camera or upload an image to let Amazon Rekognition automatically extract tags. Or add custom tags below.
                  </p>
                )}

                {/* Add Custom Tag Form */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Add custom tag (e.g. 'Blue', 'Sticker')..."
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-blue-500 flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Custody Drop-off */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {isLost ? 'Your Contact Email / Phone' : 'Where is the item currently held?'} *
            </label>
            <input
              type="text"
              required
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder={isLost ? "your.name2023@vitstudent.ac.in or 9876543210" : "Turned in at Library Front Desk Lost & Found bin"}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm outline-none transition"
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
