import { useState, useRef } from "react"
import './ImageVerificator.css'

interface VerificationResponse {
  label: string;
  probability: number;
  threshold: number;
  error?: string;
}

export default function ImageVerificator() {
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setResponse(null);
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
            setImage(file);
            setPreview(canvas.toDataURL("image/jpeg"));
            stopCamera();
            setResponse(null);
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  const handleUpload = async () => {
    if (!image) return alert("Selecciona una imagen primero");
    setLoading(true);
    setResponse(null);

    const formData = new FormData();
    formData.append("image", image);

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    try {
      const res = await fetch(`${apiUrl}/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log(data);
      setResponse(data);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Error al conectar con el servidor", label: "", probability: 0, threshold: 0 });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPreview(null);
    setImage(null);
    setResponse(null);
    stopCamera();
  };

  const verificationMessage = (isVerified: boolean, percentage: number) => {
    if (!isVerified) {
      return {
        title: "No Verificado",
        message: `Identidad no confirmada. Confianza: ${percentage}%`,
        type: "warning",
        details: `No soy yo. probabilidad ${percentage}%.`
      };
    }  
    return {
      title: "Verificación Exitosa",
      message: `¡Identidad confirmada! Confianza: ${percentage}%`,
      type: "success",
      details: `La imagen ha sido verificada exitosamente con una probabilidad del ${percentage}%.`
    };
  }

  const getResultMessage = () => {
    if (!response) return null;
    
    if (response.error) {
      return {
        title: "❌ Error",
        message: response.error,
        type: "error",
        details: undefined
      };
    }

    const isVerified = response.label === "me" || response.probability >= response.threshold;
    const percentage = (response.probability * 100).toFixed(2);

    return verificationMessage(isVerified, parseFloat(percentage));
  };

  const resultInfo = getResultMessage();

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">🔍 Verificador de Imágenes</h1>
        <p className="subtitle">Verifica tu identidad mediante reconocimiento facial</p>

        {!showCamera && !preview && (
          <div className="upload-section">
            <div className="button-group">
              <label htmlFor="file-input" className="btn btn-primary">
                📁 Subir Imagen
              </label>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input"
              />
              
              <button onClick={startCamera} className="btn btn-secondary">
                📸 Tomar Foto
              </button>
            </div>
          </div>
        )}

        {showCamera && (
          <div className="camera-section">
            <video ref={videoRef} autoPlay playsInline className="video-preview" />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="button-group">
              <button onClick={capturePhoto} className="btn btn-primary">
                📷 Capturar
              </button>
              <button onClick={stopCamera} className="btn btn-danger">
                ❌ Cancelar
              </button>
            </div>
          </div>
        )}

        {preview && !showCamera && (
          <div className="preview-section">
            <img src={preview} alt="preview" className="image-preview" />
            
            <div className="button-group">
              <button
                onClick={handleUpload}
                disabled={loading}
                className="btn btn-success"
              >
                {loading ? "⏳ Verificando..." : "✓ Verificar Imagen"}
              </button>
              <button onClick={resetForm} className="btn btn-secondary">
                🔄 Nueva Imagen
              </button>
            </div>
          </div>
        )}

        {resultInfo && (
          <div className={`result-card ${resultInfo.type}`}>
            <h2 className="result-title">{resultInfo.title}</h2>
            <p className="result-message">{resultInfo.message}</p>
            {resultInfo.details && (
              <p className="result-details">{resultInfo.details}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}