import { useEffect, useState } from 'react';
export function usePicture() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = (next?: File) => {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('JPG, PNG yoki WebP rasm tanlang.');
      return;
    }
    if (next.size > 4 * 1024 * 1024) {
      setError('Rasm 4 MB dan oshmasin.');
      return;
    }
    setError('');
    setFile(next);
  };
  const clear = () => {
    setFile(null);
    setError('');
  };
  return { file, preview, error, choose, clear };
}
