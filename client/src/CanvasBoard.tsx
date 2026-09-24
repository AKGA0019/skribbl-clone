import { useEffect, useRef, useState } from 'react';
import type { StrokePoint } from './types';
import { socket } from './socket';

type Props = {
  canDraw: boolean;
  initialStrokes: StrokePoint[];
};

const COLORS = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

export default function CanvasBoard({ canDraw, initialStrokes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  const setup = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    redraw(initialStrokes);
  };

  const redraw = (strokes: StrokePoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    let last = { x: 0, y: 0 };
    for (const stroke of strokes) {
      const x = stroke.x * rect.width;
      const y = stroke.y * rect.height;
      if (stroke.type === 'start') {
        last = { x, y };
        drawPoint(ctx, x, y, stroke);
      } else {
        drawLine(ctx, last.x, last.y, x, y, stroke);
        last = { x, y };
      }
    }
  };

  const drawPoint = (ctx: CanvasRenderingContext2D, x: number, y: number, stroke: StrokePoint) => {
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(x, y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, stroke: StrokePoint) => {
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    drawingRef.current = true;
    lastRef.current = point;
    const stroke: StrokePoint = { ...point, px: point.x, py: point.y, color, size, tool, type: 'start' };
    renderRemote(stroke);
    socket.emit('draw_start', stroke);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawingRef.current) return;
    const point = localPoint(event);
    const previous = lastRef.current;
    const stroke: StrokePoint = { ...point, px: previous.x, py: previous.y, color, size, tool, type: 'move' };
    renderRemote(stroke);
    socket.emit('draw_move', stroke);
    lastRef.current = point;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    socket.emit('draw_end');
  };

  const renderRemote = (stroke: StrokePoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = stroke.x * rect.width;
    const y = stroke.y * rect.height;
    if (stroke.type === 'start') drawPoint(ctx, x, y, stroke);
    else drawLine(ctx, stroke.px * rect.width, stroke.py * rect.height, x, y, stroke);
  };

  useEffect(() => {
    setup();
    const onData = (stroke: StrokePoint) => renderRemote(stroke);
    const onClear = () => redraw([]);
    const onState = (strokes: StrokePoint[]) => redraw(strokes);
    socket.on('draw_data', onData);
    socket.on('canvas_clear', onClear);
    socket.on('canvas_state', onState);
    window.addEventListener('resize', setup);
    return () => {
      socket.off('draw_data', onData);
      socket.off('canvas_clear', onClear);
      socket.off('canvas_state', onState);
      window.removeEventListener('resize', setup);
    };
  }, []);

  useEffect(() => redraw(initialStrokes), [initialStrokes]);

  const clear = () => socket.emit('canvas_clear');
  const undo = () => socket.emit('draw_undo');

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <div className="tool-group">
          <button className={tool === 'pen' ? 'tool active' : 'tool'} onClick={() => setTool('pen')} disabled={!canDraw}>✎ Pen</button>
          <button className={tool === 'eraser' ? 'tool active' : 'tool'} onClick={() => setTool('eraser')} disabled={!canDraw}>⌫ Eraser</button>
          <button className="tool" onClick={undo} disabled={!canDraw}>↶ Undo</button>
          <button className="tool danger" onClick={clear} disabled={!canDraw}>Clear</button>
        </div>
        <div className="color-row">
          {COLORS.map((c) => <button key={c} aria-label={`color ${c}`} className={`color-dot ${color === c && tool === 'pen' ? 'selected' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setTool('pen'); }} disabled={!canDraw} />)}
          <label className="size-label">Size <input type="range" min="2" max="28" value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={!canDraw} /></label>
        </div>
      </div>
      <canvas ref={canvasRef} className={`drawing-canvas ${canDraw ? 'draw-enabled' : ''}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} />
    </div>
  );
}
