import React, { useState } from 'react';
import { resolveImageUrl } from '../../utils/imageUrl.js';

/**
 * HTTPS-only image with graceful fallback — no broken icons or console noise.
 */
const SafeImage = ({ src, alt = '', fallback = null, className, style, ...rest }) => {
  const [failed, setFailed] = useState(false);
  const url = resolveImageUrl(src);

  if (!url || failed) {
    return fallback ?? null;
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
};

export default SafeImage;
