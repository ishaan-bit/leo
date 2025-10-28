/**
 * CameraUpload.tsx
 * Mobile-friendly camera/photo upload component for reflection input
 * Supports native camera capture and photo library on iOS/Android
 */
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface CameraUploadProps {
  onPhotoSelected: (file: File) => void;
  isDisabled?: boolean;
  className?: string;
}

export default function CameraUpload({ 
  onPhotoSelected, 
  isDisabled = false,
  className = '' 
}: CameraUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Pass file to parent
    onPhotoSelected(file);
  };

  const handleClick = () => {
    if (!isDisabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={className}>
      {/* Hidden file input with mobile camera support */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isDisabled}
      />
      
      {/* Camera button */}
      <motion.button
        onClick={handleClick}
        disabled={isDisabled}
        whileHover={!isDisabled ? { scale: 1.05 } : {}}
        whileTap={!isDisabled ? { scale: 0.95 } : {}}
        className={`
          w-16 h-16 rounded-full
          bg-gradient-to-br from-purple-400 to-pink-400
          flex items-center justify-center
          shadow-lg hover:shadow-xl
          transition-all duration-300
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:from-purple-500 hover:to-pink-500'}
        `}
        aria-label="Upload photo or take picture"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-8 h-8 text-white" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
          />
        </svg>
      </motion.button>
      
      {/* Optional preview (hidden for now - can be shown if needed) */}
      {preview && (
        <div className="hidden">
          <img src={preview} alt="Preview" className="w-full h-auto rounded-lg" />
        </div>
      )}
    </div>
  );
}
