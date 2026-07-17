"use client";

import { useRef, useState } from "react";
import { Camera, Upload, Loader2, CheckCircle2, X } from "lucide-react";

interface ExpiryResult {
  days_left: number | null;
  expiry_date: string | null;
  source: "printed_expiry" | "mfd_plus_shelf_life" | "shelf_life_from_today" | "unknown";
  confidence: "high" | "medium" | "low";
  raw_text_found: string | null;
}

interface ExpiryDateScannerProps {
  onResult: (expiry: ExpiryResult) => void;
  onClose: () => void;
}

export default function ExpiryDateScanner({ onResult, onClose }: ExpiryDateScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleImage = async (file: File) => {
    if (!file) return;
    setError(null);
    setWarning(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append("label", file);

      const res = await fetch("/api/scan-expiry-date", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success || !data.expiry) {
        setError("Couldn't read the date clearly. Try a sharper, well-lit photo.");
        setIsScanning(false);
        return;
      }

      const expiry = data.expiry as ExpiryResult;

      if (expiry.confidence === "low" || expiry.days_left === null) {
        setError("No printed expiry date found. Try a photo of the cap, seal, or pack edge, or skip and enter it manually.");
        setIsScanning(false);
        return;
      }

      if (expiry.confidence === "medium") {
        setWarning("Date format was partially unclear — double-check against the physical package.");
      }

      setSuccess(true);
      setTimeout(() => {
        onResult(expiry);
      }, 800);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-bold text-sm tracking-tight">Scan Expiry Date</h3>
            <p className="text-xs text-foreground/50 mt-0.5">Point your camera at the printed MFD / EXP / Best Before date</p>
          </div>
          <button
            onClick={onClose}
            title="Close expiry scanner"
            aria-label="Close expiry scanner"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="w-full h-44 rounded-2xl border-2 border-dashed border-border bg-foreground/3 flex items-center justify-center overflow-hidden relative">
            {preview ? (
              <img src={preview} alt="Expiry date preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center space-y-1">
                <Camera size={28} className="mx-auto text-foreground/30" />
                <p className="text-xs text-foreground/40">No image selected</p>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                <Loader2 size={24} className="animate-spin text-white" />
                <p className="text-xs text-white font-semibold">Reading date...</p>
              </div>
            )}

            {success && (
              <div className="absolute inset-0 bg-green-500/80 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={28} className="text-white" />
                <p className="text-xs text-white font-bold">Expiry date found!</p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {warning && (
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-2">
              <p className="text-xs text-orange-500">{warning}</p>
            </div>
          )}

          {!preview && (
            <div className="rounded-xl bg-foreground/5 px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Tips for best results</p>
              <ul className="text-xs text-foreground/50 space-y-0.5">
                <li>• Look for "MFD", "EXP", "Use By" or "Best Before" text</li>
                <li>• Often printed near the cap, seal, or pack edge</li>
                <li>• Use good lighting and keep the camera steady</li>
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              title="Capture expiry date"
              aria-label="Capture expiry date"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              title="Upload expiry date photo"
              aria-label="Upload expiry date photo"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
            />

            <button
              onClick={() => cameraRef.current?.click()}
              disabled={isScanning || success}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Camera size={15} /> Camera
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              disabled={isScanning || success}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-foreground/5 disabled:opacity-40 transition-all"
            >
              <Upload size={15} /> Gallery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
