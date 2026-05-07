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
    const node = ref.current;
    let active = true;
    node.innerHTML = "";
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(text, { width: size, margin: 2 }).then((canvas: HTMLCanvasElement) => {
        if (active) node.appendChild(canvas);
      });
    });
    return () => {
      active = false;
      node.innerHTML = "";
    };
  }, [text, size]);

  return <div ref={ref} />;
}
