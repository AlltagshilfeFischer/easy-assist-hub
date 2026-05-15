import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, RotateCcw, X, PenLine, WifiOff, Wifi, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Termin {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
}

interface Props {
  kundeName: string;
  monat: number;
  jahr: number;
  termine: Termin[];
  liveGeleistet: number;
  isOnline: boolean;
  onConfirm: (dataUrl: string, signerName: string) => void;
  onCancel: () => void;
  headerTitle?: string;
  showHinweis?: boolean;
}

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const SKIP_STATUS = ['cancelled', 'abgesagt_rechtzeitig'];

export default function KundenSignaturPad({
  kundeName,
  monat,
  jahr,
  termine,
  liveGeleistet,
  isOnline,
  onConfirm,
  onCancel,
  headerTitle,
  showHinweis = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [signerName, setSignerName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);

  const relevantTermine = termine.filter(t => !SKIP_STATUS.includes(t.status));

  // Init canvas mit korrektem DPR für scharfe Linien
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
  }, []);

  useEffect(() => {
    // Body-Scroll sperren solange Overlay offen
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(initCanvas, 80);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, [initCanvas]);

  // Canvas bei Orientation-Change neu initialisieren
  useEffect(() => {
    const handleOrientationChange = () => {
      setHasDrawn(false);
      setTimeout(initCanvas, 200);
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [initCanvas]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    const me = e as React.MouseEvent;
    return { x: me.clientX - rect.left, y: me.clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e);
    setHasDrawn(true);
    setShowEmptyWarning(false);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    // Quadratische Kurve für smoothere Linien
    const midX = (lastPointRef.current.x + pos.x) / 2;
    const midY = (lastPointRef.current.y + pos.y) / 2;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    ctx.stroke();
    lastPointRef.current = pos;
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasDrawn(false);
    setShowEmptyWarning(false);
  };

  const handleConfirm = () => {
    if (!hasDrawn) {
      setShowEmptyWarning(true);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl, signerName.trim() || kundeName);
  };

  return (
    // Vollbild-Overlay, fixed über alles
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col"
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PenLine className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
              {headerTitle ?? `Unterschrift: ${kundeName}`}
            </p>
            <p className="text-xs text-gray-500">
              {monthNames[monat - 1]} {jahr}
              {' · '}
              {liveGeleistet.toFixed(1)} h geleistet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOnline && (
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}
          {isOnline && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Wifi className="h-3 w-3" />
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminliste + Name — horizontal kompakt */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          {/* Terminübersicht */}
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <p className="text-xs text-gray-500 shrink-0 pt-0.5">Termine:</p>
            <div className="flex flex-wrap gap-1 min-w-0">
              {relevantTermine.length === 0 ? (
                <span className="text-xs text-gray-400">Keine</span>
              ) : (
                relevantTermine.map(t => {
                  const start = new Date(t.start_at);
                  const end = new Date(t.end_at);
                  return (
                    <span
                      key={t.id}
                      className="inline-flex items-center text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 whitespace-nowrap"
                    >
                      {format(start, 'dd.MM.', { locale: de })}
                      {' '}
                      {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                    </span>
                  );
                })
              )}
            </div>
          </div>
          {/* Name-Eingabe */}
          <div className="flex items-center gap-2 sm:w-64 shrink-0">
            <label className="text-xs text-gray-500 whitespace-nowrap">Name:</label>
            <Input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder={kundeName}
              className="h-7 text-sm flex-1"
            />
          </div>
        </div>
      </div>

      {/* Hinweis: Unterschrift bleibt gültig auch bei Terminänderungen */}
      {showHinweis && (
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Hinweis: Geplante Termine können sich noch ändern — diese Unterschrift bleibt trotzdem gültig.</span>
          </div>
        </div>
      )}

      {/* Canvas — nimmt den gesamten verbleibenden Platz */}
      <div className="flex-1 relative bg-white min-h-0">
        {/* Führungslinie */}
        <div
          className="absolute pointer-events-none"
          style={{ bottom: '40px', left: '20px', right: '20px', borderBottom: '1px dashed #d1d5db' }}
        />
        <span
          className="absolute text-[10px] text-gray-300 pointer-events-none select-none"
          style={{ bottom: '20px', left: '20px' }}
        >
          Hier unterschreiben
        </span>

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
        {showEmptyWarning && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Bitte zuerst unterschreiben.
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5 flex-1 h-11"
            onClick={clearCanvas}
          >
            <RotateCcw className="h-4 w-4" />
            Leeren
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            className="flex-[2] h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleConfirm}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isOnline ? 'Unterschreiben & Bestätigen' : 'Lokal speichern'}
          </Button>
        </div>
      </div>
    </div>
  );
}
