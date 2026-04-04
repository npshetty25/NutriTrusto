"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onError, onClose }: BarcodeScannerProps) {
  const isComponentMounted = useRef(true);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;

    const onScanSuccess = (decodedText: string) => {
      if (isComponentMounted.current) {
        html5QrCodeRef.current?.stop().then(() => {
           html5QrCodeRef.current?.clear();
           onScan(decodedText);
        }).catch(console.error);
      }
    };

    // Delay instantiation to bypass React 18 Strict Mode double-mount glitch
    const mountTimer = setTimeout(() => {
      if (!isComponentMounted.current) return;
      
      html5QrCodeRef.current = new Html5Qrcode("reader");

      const startCamera = async () => {
        if (!html5QrCodeRef.current) return;
        try {
          await html5QrCodeRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            onScanSuccess,
            (error) => { if (onError) onError(error); }
          );
        } catch (err: any) {
          // Fallback to basic user camera if environment explicitly fails
          try {
            await html5QrCodeRef.current?.start(
              { facingMode: "user" },
              { fps: 10, qrbox: { width: 250, height: 150 } },
              onScanSuccess,
              (error) => { if (onError) onError(error); }
            );
          } catch (err2: any) {
            setDebugError("Camera failed to initialize: " + (err?.message || err?.toString()));
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
  }, [onScan, onError]);

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-3xl overflow-hidden relative sleek-shadow">
        <div className="p-4 border-b border-border flex justify-between items-center bg-foreground/5">
          <h3 className="font-bold tracking-tight text-foreground">Scan Barcode</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-4 relative">
          {debugError && (
            <div className="absolute inset-4 z-10 flex flex-col items-center justify-center p-6 bg-card/95 backdrop-blur-md rounded-xl text-center shadow-lg border border-danger/20">
              <span className="text-2xl mb-2 block">🚫</span>
              <h4 className="text-danger font-bold text-sm mb-1">Camera Error</h4>
              <p className="text-xs text-foreground/80">{debugError}</p>
            </div>
          )}
          
           <div id="reader" className="w-full overflow-hidden rounded-xl border border-border min-h-62.5 bg-black/5 flex items-center justify-center relative">
             <span className="text-xs font-semibold text-foreground/40 uppercase tracking-widest animate-pulse">Requesting Camera...</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-3 pb-4 px-4">
          <p className="text-center text-xs text-foreground/50">
            Position the product barcode inside the box
          </p>
        </div>
      </div>
    </div>
  );
}
