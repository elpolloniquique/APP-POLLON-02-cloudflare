import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react';

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

function isValidImageUrl(url) {
  return /^https?:\/\/.+/i.test((url || '').trim());
}

export function CategoryImageEditor({
  imageUrl = '',
  onChange,
  onUpload,
  onError,
  uploading = false,
}) {
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidImageUrl(url)) {
      onError?.('La URL debe comenzar con http:// o https://');
      return;
    }
    onChange?.(url);
    setUrlInput('');
  };

  const handleFiles = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    try {
      const url = await onUpload(file);
      onChange?.(url);
    } catch (err) {
      onError?.(err?.message || 'No se pudo subir la imagen');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-pollon-red/25 bg-white shadow-md">
            {imageUrl ? (
              <img src={imageUrl} alt="Vista previa categoría" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                <ImagePlus className="h-8 w-8" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <p className="max-w-[6.5rem] text-center text-[10px] leading-tight text-gray-500">
            Vista previa en inicio
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
              Imagen de categoría
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              Se muestra solo en la sección <strong className="text-pollon-black">「Explora nuestro menú」</strong> del inicio.
              En la tienda y el resto del sitio se mantienen solo los nombres.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://ejemplo.com/foto.jpg"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
                disabled={uploading}
              />
            </div>
            <button
              type="button"
              onClick={applyUrl}
              disabled={!urlInput.trim() || uploading}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Usar URL
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-pollon-red/40 hover:bg-red-50/40 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir foto desde PC o móvil
              </>
            )}
          </button>

          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange?.('')}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Quitar imagen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
