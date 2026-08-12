import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Reklam alani.
 * - Premium uyeye ve admine hicbir sey gostermez.
 * - Slot AdSense ise sunucudaki snippet basilir, degilse admin banner'i gosterilir.
 * - Gorununce "impression", tiklaninca "click" olayi kaydedilir.
 */
export default function AdSlot({ code, className = '', label = 'Reklam' }) {
  const { isPremium } = useAuth();
  const [data, setData] = useState(null);
  const containerRef = useRef(null);
  const impressionSent = useRef(false);

  useEffect(() => {
    if (isPremium) return undefined;
    let cancelled = false;
    api
      .get(`/ads/slot/${code}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, isPremium]);

  // Ekranda gorundugu anda tek sefer gosterim kaydi
  useEffect(() => {
    const adId = data?.ad?.id;
    if (!adId || !containerRef.current || impressionSent.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !impressionSent.current) {
          impressionSent.current = true;
          api.post(`/ads/${adId}/event`, { type: 'impression' }).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data]);

  if (isPremium || !data || data.hidden) return null;

  if (data.adsense) {
    return (
      <div className={className} ref={containerRef}>
        <div className="mb-1 text-caption uppercase tracking-wider text-secondary/70">{label}</div>
        <div dangerouslySetInnerHTML={{ __html: data.adsense }} />
      </div>
    );
  }

  if (!data.ad) return null;

  const handleClick = () => {
    api.post(`/ads/${data.ad.id}/event`, { type: 'click' }).catch(() => {});
  };

  return (
    <div className={className} ref={containerRef}>
      <div className="mb-1 text-caption uppercase tracking-wider text-secondary/70">{label}</div>
      <a
        href={data.ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="block overflow-hidden rounded-lg border border-surface-variant bg-surface-container-lowest"
      >
        <img
          src={data.ad.imageUrl}
          alt={data.ad.title}
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </a>
    </div>
  );
}
