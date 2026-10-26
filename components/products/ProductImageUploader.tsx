'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ProductImageUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function ProductImageUploader({ files, onFilesChange }: ProductImageUploaderProps) {
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const validFiles = selectedFiles.filter((file) =>
      ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE,
    );

    if (validFiles.length !== selectedFiles.length) {
      setError('Hanya file JPG, PNG, WEBP, atau GIF hingga 10 MB yang dapat dipilih.');
    } else {
      setError('');
    }

    onFilesChange([...files, ...validFiles]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
    setError('');
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <Label htmlFor="product-images">Gambar produk</Label>
      <Input
        id="product-images"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileChange}
        className="h-auto py-2"
      />
      <p className="text-xs text-muted-foreground">Pilih satu atau beberapa gambar (JPG, PNG, WEBP, GIF; maksimal 10 MB per gambar).</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative">
              <Image
                src={previews[index]}
                alt={`Pratinjau ${file.name}`}
                width={320}
                height={224}
                unoptimized
                className="h-28 w-full rounded-md border object-cover"
              />
              <button
                type="button"
                aria-label={`Hapus gambar ${file.name}`}
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImagePlus className="h-4 w-4" />
          Belum ada gambar yang dipilih.
        </div>
      )}
    </div>
  );
}
