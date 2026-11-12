import { useState } from 'react';
import { assetUrl } from '../api/client';

interface AvatarProps {
  name: string;
  src?: string;
  /** Size and text-size classes, e.g. "size-12 text-xl". */
  className: string;
  /** Alt text. Leave empty when the name is shown right next to the picture (screen readers would read it twice). */
  alt?: string;
  eager?: boolean;
}

/** Profile picture, or a round placeholder with the first letter of the name when there is none (or it fails to load). */
export default function Avatar({ name, src, className, alt = '', eager = false }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      <img
        src={assetUrl(src)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailedSrc(src)}
        className={`shrink-0 rounded-full bg-slate-100 object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-700 ${className}`}
    >
      {name.charAt(0)}
    </div>
  );
}
