'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageSquare, Trash, ArrowUpRight } from '@phosphor-icons/react';

function encodePhoto(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) throw new Error('The camera is not ready yet. Please try again.');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the photo. Try another browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/jpeg', 0.85);
  if (!data.startsWith('data:image/jpeg;') || data.length > 4000000)
    throw new Error('This photo is too large. Choose a smaller image.');
  return data;
}

export function QuestionPhoto({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [camera, setCamera] = useState<'off' | 'opening' | 'live'>('off');
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const upload = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const cameraButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onBusyChange(processing || camera !== 'off');
    return () => onBusyChange(false);
  }, [processing, camera, onBusyChange]);
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function stopCamera() {
    generation.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera('off');
    setReady(false);
  }
  async function openCamera() {
    stopCamera();
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Live camera needs HTTPS or localhost and a supported browser. Upload a photo or try the device camera below.',
      );
      return;
    }
    const request = ++generation.current;
    setCamera('opening');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      if (generation.current !== request) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      for (const track of media.getTracks())
        track.onended = () => {
          stopCamera();
          setError('The camera stopped. Try again or upload a photo.');
        };
      setCamera('live');
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (error) {
      if (generation.current !== request) return;
      stopCamera();
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setError(
        denied
          ? 'Camera permission was not granted. Allow camera access in your browser settings, or upload a photo.'
          : 'The camera could not be opened. It may be unavailable or in use. Upload a photo or try again.',
      );
    }
  }
  function capture() {
    try {
      const frame = video.current!;
      setPhoto(encodePhoto(frame, frame.videoWidth, frame.videoHeight));
      setError('');
      stopCamera();
      cameraButton.current?.focus();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function choose(file?: File) {
    if (!file) return;
    stopCamera();
    const request = ++generation.current;
    setError('');
    setProcessing(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Choose a PNG, JPEG, or WebP photo. Export HEIC photos as JPEG first.');
      if (file.size > 20000000) throw new Error('Choose an image smaller than 20 MB.');
      const bitmap = await createImageBitmap(file);
      try {
        if (generation.current === request)
          setPhoto(encodePhoto(bitmap, bitmap.width, bitmap.height));
      } finally {
        bitmap.close();
      }
    } catch (error) {
      if (generation.current === request)
        setError(
          error instanceof Error ? error.message : 'Could not read this image. Try another photo.',
        );
    } finally {
      if (generation.current === request) setProcessing(false);
    }
  }

  return (
    <section className="question-photo" aria-labelledby="question-photo-title">
      <h3 id="question-photo-title">
        Add a photo <span>(optional)</span>
      </h3>
      <p className="form-hint">
        Show the issue or error message. Hide passwords, faces, and personal details. The photo
        becomes public only if your question is approved.
      </p>
      <input type="hidden" name="photo" value={photo} />
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose question photo"
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={nativeCamera}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        aria-label="Take photo with device camera"
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="button-row">
        <button
          type="button"
          className="button secondary small"
          disabled={processing || camera !== 'off'}
          onClick={() => upload.current?.click()}
        >
          <ImageSquare size={18} />
          {photo ? 'Replace photo' : 'Upload photo'}
        </button>
        <button
          ref={cameraButton}
          type="button"
          className="button secondary small"
          disabled={processing || camera !== 'off'}
          onClick={openCamera}
        >
          <Camera size={18} />
          {photo ? 'Retake photo' : 'Use camera'}
        </button>
        {photo && camera === 'off' && (
          <button
            type="button"
            className="button secondary small"
            disabled={processing}
            onClick={() => {
              setPhoto('');
              setError('');
            }}
          >
            <Trash size={17} />
            Remove photo
          </button>
        )}
      </div>
      {processing && <p role="status">Preparing your photo…</p>}
      {camera !== 'off' && (
        <div className="question-camera">
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
            onCanPlay={() => setReady(true)}
          />
          <p role="status">
            {camera === 'opening'
              ? 'Waiting for camera permission…'
              : 'Frame the issue, then capture your photo.'}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button primary small"
              disabled={!ready}
              onClick={capture}
            >
              <Camera size={18} />
              Capture photo
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                stopCamera();
                cameraButton.current?.focus();
              }}
            >
              Cancel camera
            </button>
          </div>
        </div>
      )}
      {photo && camera === 'off' && (
        <figure className="question-photo-preview">
          <img src={photo} alt="Selected question photo" />
          <figcaption>Photo attached. Review it before submitting.</figcaption>
        </figure>
      )}
      {error && (
        <div className="photo-error">
          <p className="field-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="text-button"
            disabled={processing || camera !== 'off'}
            onClick={() => nativeCamera.current?.click()}
          >
            Open device camera / photo picker
          </button>
        </div>
      )}
      <p className="form-hint">
        One PNG, JPEG, or WebP image, up to 20 MB before resizing. Photos are resized for upload.
        Nothing is uploaded until you submit.
      </p>
    </section>
  );
}

export function QuestionImage({ photo, title }: { photo?: string; title: string }) {
  if (!photo) return null;
  return (
    <a
      className="question-image"
      href={photo}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open photo for ${title} in a new tab`}
    >
      <img src={photo} alt={`Photo attached to: ${title}`} loading="lazy" />
      <span>
        Open full photo <ArrowUpRight size={14} aria-hidden="true" />
      </span>
    </a>
  );
}
