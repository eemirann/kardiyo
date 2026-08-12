import { useRef, useState } from 'react';
import { api } from '../api/client';
import { Icon, ProgressBar } from './ui';

/**
 * Dosyayi once API'den imzali adres alarak dogrudan Cloudflare R2'ye yukler.
 * Basarili olunca { key, publicUrl } doner.
 */
export default function FileUpload({ kind = 'image', accept, onUploaded, label = 'Dosya seç' }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const { uploadUrl, key, publicUrl } = await api.post('/admin/uploads/presign', {
        kind,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      // Ilerleme cubugu icin fetch yerine XHR
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Yükleme başarısız (HTTP ${xhr.status})`));
        xhr.onerror = () => reject(new Error('Ağ hatası: dosya yüklenemedi.'));
        xhr.send(file);
      });

      setProgress(100);
      onUploaded({ key, publicUrl });
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept || (kind === 'video' ? 'video/mp4,video/webm' : 'image/*')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button type="button" className="btn-outline" onClick={() => inputRef.current?.click()}>
        <Icon name="upload" size={18} /> {label}
      </button>
      {progress !== null && (
        <div className="mt-2">
          <ProgressBar value={progress} max={100} />
          <div className="mt-1 text-caption text-secondary">
            {progress < 100 ? `Yükleniyor… %${progress}` : 'Yükleme tamamlandı'}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-caption text-error">{error}</p>}
    </div>
  );
}
