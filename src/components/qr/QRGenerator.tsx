// src/components/qr/QRGenerator.tsx
"use client";
import { useEffect, useRef } from "react";

interface QRGeneratorProps {
  text: string;
  size?: number;
}

export function QRGenerator({ text, size = 200 }: QRGeneratorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(text, { width: size, margin: 2 }).then((canvas: HTMLCanvasElement) => {
        if (ref.current) ref.current.appendChild(canvas);
      });
    });
  }, [text, size]);

  return <div ref={ref} />;
}
