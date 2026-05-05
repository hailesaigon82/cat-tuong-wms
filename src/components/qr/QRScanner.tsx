// src/components/qr/QRScanner.tsx
"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui";

interface QRScannerProps {
  onScan: (data: string) => void;
  prefix?: string;
  onClose?: () => void;
  label?: string;
}

export function QRScanner({ onScan, prefix, onClose, label = "Quét mã QR" }: QRScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const animRef    = useRef<number>(0);
  const jsQRRef    = useRef<any>(null);
  const [status, setStatus] = useState("Đang khởi động camera...");

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
      // Import jsQR một lần duy nhất — không import trong animation loop
      try {
        const mod = await import("jsqr");
        jsQRRef.current = mod.default;
      } catch {
        setStatus("Không thể tải thư viện QR");
        return;
      }

      // Xin quyền camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Đưa mã QR vào khung hình...");

        const tick = () => {
          if (!active) return;
          const video  = videoRef.current;
          const canvas = canvasRef.current;
          const jsQR   = jsQRRef.current;

          if (video && canvas && jsQR && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              if (code) {
                const data = code.data;
                if (!prefix || data.startsWith(prefix)) {
                  setStatus("✅ Đã quét thành công!");
                  onScan(data);
                  return; // Dừng loop sau khi scan thành công
                } else {
                  setStatus(`QR không hợp lệ: ${data.slice(0, 20)}`);
                }
              }
            }
          }
          animRef.current = requestAnimationFrame(tick);
        };

        animRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        setStatus(`Không thể mở camera: ${err?.message ?? "unknown"}`);
        if (onClose) onClose();
      }
    }

    start();
    return () => {
      active = false;
      stopStream();
    };
  }, [onScan, prefix, onClose, stopStream]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-lg overflow-hidden bg-black min-h-[200px]">
        <video
          ref={videoRef}
          className="w-full max-h-64 object-cover"
          autoPlay muted playsInline
        />
        {/* Khung ngắm giữa màn hình */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-white rounded-lg opacity-70" />
        </div>
        <div className="scanner-line" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-xs text-center font-medium text-gray-600">{status}</p>
      <p className="text-xs text-center text-gray-400">{label}</p>
      {onClose && (
        <Button variant="outline" size="sm" onClick={() => { stopStream(); onClose(); }}>
          Hủy
        </Button>
      )}
    </div>
  );
}
