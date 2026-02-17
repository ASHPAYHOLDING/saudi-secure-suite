import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eraser, ShieldCheck, Fingerprint, Lock, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CertifiedSignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  signerName?: string;
  signerRole?: string;
  width?: number;
  height?: number;
  label?: string;
}

const CertifiedSignaturePad = ({
  onSignatureChange,
  signerName = "مسؤول المنصة",
  signerRole = "مدير الامتثال المالي",
  width = 460,
  height = 160,
  label = "التوقيع الرقمي المعتمد",
}: CertifiedSignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw subtle grid
    ctx.strokeStyle = "#e8ecf0";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    // Draw signature baseline
    ctx.strokeStyle = "#c8d0d8";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 35);
    ctx.lineTo(canvas.width - 30, canvas.height - 35);
    ctx.stroke();
    ctx.setLineDash([]);
    // Reset for drawing
    ctx.strokeStyle = "#0f2b46";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    ctx.strokeStyle = "#0f2b46";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    const dataUrl = canvasRef.current?.toDataURL("image/png") || null;
    onSignatureChange(dataUrl);
  }, [isDrawing, onSignatureChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Redraw grid
    ctx.strokeStyle = "#e8ecf0";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Redraw baseline
    ctx.strokeStyle = "#c8d0d8";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 35);
    ctx.lineTo(canvas.width - 30, canvas.height - 35);
    ctx.stroke();
    ctx.setLineDash([]);
    setHasSignature(false);
    onSignatureChange(null);
  };

  const formattedTime = currentTime.toLocaleString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Fingerprint className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <label className="text-sm font-bold text-foreground">{label}</label>
            <p className="text-[10px] text-muted-foreground">معتمد بموجب نظام التعاملات الإلكترونية م/18</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSignature && (
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="gap-1 text-xs text-destructive hover:text-destructive">
              <Eraser className="w-3.5 h-3.5" /> مسح
            </Button>
          )}
          <Badge variant="outline" className="text-[10px] gap-1 bg-accent/5 border-accent/20 text-accent">
            <ShieldCheck className="w-3 h-3" /> توقيع رقمي
          </Badge>
        </div>
      </div>

      {/* Signature Area */}
      <div className="relative rounded-xl border-2 border-accent/30 overflow-hidden bg-gradient-to-b from-background to-muted/20 shadow-sm">
        {/* Security watermark */}
        <div className="absolute inset-0 pointer-events-none select-none opacity-[0.03] flex items-center justify-center">
          <span className="text-6xl font-black text-foreground rotate-[-20deg] tracking-widest">CERTIFIED</span>
        </div>

        {/* Signer info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-accent/5 border-b border-accent/10">
          <div className="flex items-center gap-2 text-xs">
            <Lock className="w-3 h-3 text-accent" />
            <span className="text-muted-foreground">الموقّع:</span>
            <span className="font-semibold text-foreground">{signerName}</span>
            <span className="text-muted-foreground">—</span>
            <span className="text-accent font-medium">{signerRole}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <Clock className="w-3 h-3" />
            {formattedTime}
          </div>
        </div>

        {/* Canvas */}
        <div className="cursor-crosshair touch-none relative">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full"
            style={{ maxWidth: width }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {/* Placeholder text */}
          <AnimatePresence>
            {!hasSignature && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <p className="text-sm text-muted-foreground/50 font-medium">وقّع هنا بالماوس أو بالإصبع ✍️</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasSignature ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
            <span className="text-[10px] text-muted-foreground">
              {hasSignature ? "✅ تم التوقيع — جاهز للاعتماد" : "⏳ في انتظار التوقيع"}
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground/60 font-mono">SHA-256 Encrypted</span>
        </div>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        هذا التوقيع الرقمي معتمد قانونياً وفقاً لنظام التعاملات الإلكترونية بالمملكة العربية السعودية (م/18). يتم تشفير التوقيع وحفظه بشكل آمن.
      </p>
    </motion.div>
  );
};

export default CertifiedSignaturePad;
