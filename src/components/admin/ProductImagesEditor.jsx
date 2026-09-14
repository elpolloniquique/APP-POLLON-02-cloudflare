import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Star, Trash2, Upload } from 'lucide-react';

const MAX_IMAGES = 12;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

function isValidImageUrl(url) {
  return /^https?:\/\/.+/i.test((url || '').trim());
}

export function ProductImagesEditor({ imageUrls = [], onChange, onUpload, onError, uploading = false }) {
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const setImages = (next) => {
    const unique = [...new Set(next.map((u) => u.trim()).filter(Boolean))].slice(0, MAX_IMAGES);
    onChange(unique);
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidImageUrl(url)) {
      onError?.('La URL debe comenzar con http:// o https://');
      return;
    }
    if (imageUrls.includes(url)) {
      onError?.('Esta URL ya está en la galería');
      return;
    }
    if (imageUrls.length >= MAX_IMAGES) {
      onError?.(`Máximo ${MAX_IMAGES} imágenes por producto`);
      return;
    }
    setImages([...imageUrls, url]);
    setUrlInput('');
  };

  const removeAt = (index) => {
    setImages(imageUrls.filter((_, i) => i !== index));
  };

  const setCover = (index) => {
    if (index === 0) return;
    const next = [...imageUrls];
    const [cover] = next.splice(index, 1);
    setImages([cover, ...next]);
  };

  const canUploadMore = imageUrls.length < MAX_IMAGES && !uploading;

  const openFilePicker = () => {
    if (!canUploadMore) return;
    fileInputRef.current?.click();
  };

  const handleFiles = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length || !onUpload) return;
    const files = [...fileList];
    try {
      await onUpload(files);
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
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800">Imágenes del producto</p>
        <span className="text-xs text-gray-500">{imageUrls.length}/{MAX_IMAGES}</span>
      </div>

      {imageUrls.length > 0 ? (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border bg-white shadow-sm">
              <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { e.target.src = '/img/todo el menu.png'; }} />
              {index === 0 && (
                <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-pollon-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  <Star className="h-3 w-3 fill-current" /> Portada
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex translate-y-full gap-1 bg-black/70 p-1 transition group-hover:translate-y-0">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => setCover(index)}
                    className="flex-1 rounded bg-white/90 py-1 text-[10px] font-semibold text-gray-800"
                    title="Usar como portada"
                  >
                    Portada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="rounded bg-red-600 p-1 text-white"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={!canUploadMore}
          className="mb-4 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white py-8 text-center transition hover:border-pollon-red/40 hover:bg-red-50/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">Sin imágenes — toca aquí o usa el botón de abajo</p>
        </button>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Link2 className="h-3.5 w-3.5" /> Agregar URL de imagen
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://ejemplo.com/foto.jpg"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  addUrl();
                }
              }}
            />
            <button
              type="button"
              onClick={() => addUrl()}
              disabled={!urlInput.trim() || imageUrls.length >= MAX_IMAGES}
              className="shrink-0 rounded-lg border border-pollon-red px-3 py-2 text-sm font-semibold text-pollon-red transition hover:bg-red-50 disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Upload className="h-3.5 w-3.5" /> Subir fotos desde tu PC o móvil
          </p>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canUploadMore}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3.5 text-sm font-medium transition ${
              !canUploadMore
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : 'border-pollon-red/40 bg-white text-pollon-red hover:border-pollon-red hover:bg-red-50 active:scale-[0.99]'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Subiendo imágenes…
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" /> Seleccionar una o varias fotos
              </>
            )}
          </button>
          <p className="mt-1.5 text-xs text-gray-400">JPG, PNG, WebP o GIF · máx. 5 MB c/u · hasta {MAX_IMAGES} imágenes</p>
        </div>
      </div>
    </div>
  );
}

export { isValidImageUrl, MAX_IMAGES };
