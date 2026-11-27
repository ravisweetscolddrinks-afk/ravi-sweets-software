"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, SwitchCamera, X, RotateCw, AlertCircle, Sparkles } from "lucide-react";
import { compressImageToMax60KB } from "@/lib/imageCompression";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, sizeKB: number, previewUrl: string) => void;
}

export default function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop current stream cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start stream with given facingMode
  const startStream = useCallback(async (mode: "environment" | "user") => {
    setIsLoading(true);
    setErrorMsg(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser or environment");
      }

      // Try exact or ideal constraint
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Fallback to generic video if facingMode is not strictly supported
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setIsLoading(false);
      setErrorMsg(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings."
          : err.name === "NotFoundError" || err.name === "DevicesNotFoundError"
          ? "No camera found on this device."
          : err.message || "Failed to initialize camera"
      );
    }
  }, [stopStream]);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startStream(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startStream, stopStream]);

  // Toggle front / back camera
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Capture frame from video
  const handleCapturePhoto = async () => {
    if (!videoRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      // Trigger flash visual effect
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 180);

      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");

      // If user camera, mirror horizontal for natural selfie view
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      const rawBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );

      if (!rawBlob) throw new Error("Failed to capture image from video stream");

      // Auto-compress to <= 60 KB as requested!
      const { blob: compressedBlob, sizeKB } = await compressImageToMax60KB(rawBlob, 60 * 1024);
      const previewUrl = URL.createObjectURL(compressedBlob);

      onCapture(compressedBlob, sizeKB, previewUrl);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error("Capture photo error:", err);
      setErrorMsg("Failed to capture photo: " + err.message);
      setIsProcessing(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && !isProcessing && !isLoading && !errorMsg) {
        e.preventDefault();
        handleCapturePhoto();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, isLoading, errorMsg]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative text-white">
        {/* Top Header */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-[#348bdd] flex items-center justify-center">
              <Camera size={16} />
            </div>
            <div>
              <h3 id="camera-modal-title" className="text-xs font-medium tracking-tight text-slate-100">
                Take Warehouse Photo
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {facingMode === "environment" ? "Rear / Main Camera" : "Front Camera"} • Auto-compressed to &lt;60KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Camera Button */}
            <button
              type="button"
              onClick={handleToggleCamera}
              disabled={isLoading || Boolean(errorMsg)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs flex items-center gap-1.5 border border-slate-700 disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
              title="Switch between front and back camera"
              aria-label="Switch between front and back camera"
            >
              <SwitchCamera size={14} className="text-[#348bdd]" />
              <span className="text-[11px] font-mono">{facingMode === "environment" ? "Rear" : "Front"}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close camera"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Viewfinder Viewport */}
        <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {/* Flash Effect Overlay */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-20 pointer-events-none animate-out fade-out duration-150" />
          )}

          {/* Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-200 ${
              facingMode === "user" ? "scale-x-[-1]" : ""
            }`}
          />

          {/* Loading Indicator */}
          {isLoading && !errorMsg && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 z-10">
              <RotateCw size={24} className="animate-spin text-[#348bdd]" />
              <span className="text-xs text-slate-300">Initializing {facingMode} camera...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center gap-3 z-10">
              <AlertCircle size={28} className="text-rose-500" />
              <p className="text-xs text-slate-300 max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startStream(facingMode)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2879c9] text-white text-xs font-medium cursor-pointer transition-colors"
              >
                Retry Camera
              </button>
            </div>
          )}

          {/* Center Target Grid Crosshair */}
          {!isLoading && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
              <div className="w-48 h-48 border border-white/40 rounded-xl" />
            </div>
          )}
        </div>

        {/* Bottom Shutter Toolbar */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Space</kbd> or click button
          </div>

          {/* Big Shutter Button */}
          <button
            type="button"
            onClick={handleCapturePhoto}
            disabled={isLoading || Boolean(errorMsg) || isProcessing}
            className="w-14 h-14 rounded-full border-4 border-white/80 bg-white/20 hover:bg-white/40 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-all active:scale-95 shadow-lg group"
            title="Take Photo"
            aria-label="Take Photo"
          >
            <div className="w-10 h-10 rounded-full bg-white group-hover:bg-[#348bdd] transition-colors flex items-center justify-center text-slate-900 group-hover:text-white">
              {isProcessing ? (
                <RotateCw size={18} className="animate-spin text-slate-900" />
              ) : (
                <Camera size={18} />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
