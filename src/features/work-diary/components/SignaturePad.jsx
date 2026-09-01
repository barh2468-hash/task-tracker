import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ label, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.getBoundingClientRect().width || 420;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(170 * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#071e41";
  }, []);

  function pointerPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  }

  function draw(event) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function finishDrawing(event) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange("");
  }

  return (
    <div className="signaturePad">
      <div className="signaturePadTitle"><b>{label}</b><button type="button" className="ghost tinyBtn" onClick={clearSignature} disabled={!hasSignature}>ניקוי</button></div>
      <canvas ref={canvasRef} aria-label={label} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
      <small>יש לחתום בתוך המסגרת באמצעות האצבע או העכבר.</small>
    </div>
  );
}
