'use client';
import { useState } from 'react';
import { ImageSquare } from '@phosphor-icons/react';
import { useTechCare } from '@/context/techcare-context';
import { themedCampusImage } from '@shared/campus-images.mjs';

export function ThemedImage({ image, alt }: { image: string; alt: string }) {
  const { theme } = useTechCare();
  const source = themedCampusImage(image, theme);
  const [failedSource, setFailedSource] = useState('');
  return failedSource === source ? (
    <div className="announcement-image-missing">
      <ImageSquare size={36} />
      <span>Image unavailable</span>
    </div>
  ) : (
    <img src={source} alt={alt} onError={() => setFailedSource(source)} />
  );
}
