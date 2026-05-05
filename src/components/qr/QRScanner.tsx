// src/components/qr/QRScanner.tsx
"use client";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui";

interface QRScannerProps {
  onScan: (data: string) => void;
  prefix?: string;
  onClose?: () => void;
  label?: string;
}

export function QRScanner({ onScan, prefix, onClose, label = "Quét mã QR" }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        const tick = () => {
          if (!active) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              import("jsqr").then(({ default: jsQR }) => {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                  if (!prefix || code.data.startsWith(prefix)) {
                    onScan(code.data);
                    return;
                  }
                }
                animRef.current = requestAnimationFrame(tick);
              });
              return;
            }
          }
          animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
      } catch {
        if (onClose) onClose();
      }
    }
    start();
    return () => {
      active = false;
      stopStream();
    };
  }, [onScan, prefix, onClose, stopStream]);

  const handleClose = () => {
    stopStream();
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video ref={videoRef} className="w-full max-h-64 object-cover" autoPlay muted playsInline />
        <div className="scanner-line" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-gray-500 text-center">{label}</p>
      {onClose && (
        <Button variant="outline" size="sm" onClick={handleClose}>
          Hủy
        </Button>
      )}
    </div>
  );
}
