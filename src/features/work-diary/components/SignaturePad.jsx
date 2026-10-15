import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({ label, onChange, value = '', disabled = false }) {
  useTranslation();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const emittedValueRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.getBoundingClientRect().width || 420;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(170 * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#071e41';
  }, []);

  useEffect(() => {
    if (value === emittedValueRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    let active = true;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (value.startsWith('data:image/png;base64,')) {
      const image = new Image();
      image.onload = () => {
        if (!active) return;
        const ratio = window.devicePixelRatio || 1;
        context.drawImage(image, 0, 0, canvas.width / ratio, canvas.height / ratio);
        setHasSignature(true);
      };
      image.src = value;
    }
    return () => { active = false; };
  }, [value]);

  function pointerPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event) {
    if (disabled) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  }

  function draw(event) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function finishDrawing(event) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emittedValueRef.current = event.currentTarget.toDataURL('image/png');
    onChange(emittedValueRef.current);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    emittedValueRef.current = '';
    onChange('');
  }

  return (
    <div className="signaturePad">
      <div className="signaturePadTitle">
        <b>{t(label)}</b>
        <button
          type="button"
          className="ghost tinyBtn"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
        >
          {t('ניקוי')}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={t(label)}
        aria-disabled={disabled}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />

      <small>{t('יש לחתום בתוך המסגרת באמצעות האצבע או העכבר.')}</small>
    </div>
  );
}
