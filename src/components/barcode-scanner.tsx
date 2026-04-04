"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { RefreshCcw } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onError, onClose }: BarcodeScannerProps) {
  const isComponentMounted = useRef(true);
  const isHandlingResult = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    isComponentMounted.current = true;

    const onScanSuccess = (decodedText: string) => {
      if (isHandlingResult.current) return;
      isHandlingResult.current = true;
      if (isComponentMounted.current) {
        html5QrCodeRef.current?.stop().then(() => {
           html5QrCodeRef.current?.clear();
           onScan(decodedText);
        }).catch(console.error);
      }
    };

    isHandlingResult.current = false;
    setDebugError(null);

    // Delay instantiation to bypass React 18 Strict Mode double-mount glitch
    const mountTimer = setTimeout(() => {
      if (!isComponentMounted.current) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      const startCamera = async () => {
        if (!html5QrCodeRef.current) return;
        try {
          await html5QrCodeRef.current.start(
            { facingMode: { exact: facingMode } },
            {
              fps: 10,
              qrbox: { width: 220, height: 130 },
              aspectRatio: 1.777,
            },
            onScanSuccess,
            (error) => { if (onError) onError(error); }
          );
        } catch (err: unknown) {
          // Fallback to opposite camera when selected camera fails
          const fallbackFacingMode = facingMode === "environment" ? "user" : "environment";
          try {
            await html5QrCodeRef.current?.start(
              { facingMode: fallbackFacingMode },
              {
                fps: 10,
                qrbox: { width: 220, height: 130 },
                aspectRatio: 1.777,
              },
              onScanSuccess,
              (error) => { if (onError) onError(error); }
            );
          } catch {
            const errMessage = err instanceof Error ? err.message : String(err);
            setDebugError("Camera failed to initialize: " + errMessage);
          }
        }
      };

      startCamera();
    }, 250);

    return () => {
      isComponentMounted.current = false;
      clearTimeout(mountTimer);
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().then(() => html5QrCodeRef.current?.clear()).catch(console.error);
        } else {
          html5QrCodeRef.current.clear();
        }
      }
    };
  }, [onScan, onError, facingMode]);

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm max-h-[90vh] bg-card border border-border shadow-2xl rounded-3xl overflow-y-auto relative sleek-shadow">
        <div className="p-4 border-b border-border flex justify-between items-center bg-foreground/5">
          <h3 className="font-bold tracking-tight text-foreground">Scan Barcode</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
              className="h-8 px-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors text-xs font-semibold flex items-center gap-1"
              title="Flip camera"
            >
              <RefreshCcw size={12} /> Flip
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-4 relative">
          {debugError && (
            <div className="absolute inset-4 z-10 flex flex-col items-center justify-center p-6 bg-card/95 backdrop-blur-md rounded-xl text-center shadow-lg border border-danger/20">
              <span className="text-2xl mb-2 block">🚫</span>
              <h4 className="text-danger font-bold text-sm mb-1">Camera Error</h4>
              <p className="text-xs text-foreground/80">{debugError}</p>
            </div>
          )}
          
           <div id="reader" className="w-full overflow-hidden rounded-xl border border-border min-h-50 bg-black/5 flex items-center justify-center relative">
             <span className="text-xs font-semibold text-foreground/40 uppercase tracking-widest animate-pulse">Requesting Camera...</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-3 pb-4 px-4">
          <p className="text-center text-xs text-foreground/50">
            Position the product barcode inside the box
          </p>
          <div className="w-full space-y-2">
            <p className="text-[11px] text-center text-foreground/50">Having trouble scanning? Enter barcode manually.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g., 8901234567890"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-foreground/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim().length < 8) {
                    setDebugError("Please enter a valid barcode (at least 8 digits).");
                    return;
                  }
                  onScan(manualCode.trim());
                }}
                className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-semibold"
              >
                Use
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
