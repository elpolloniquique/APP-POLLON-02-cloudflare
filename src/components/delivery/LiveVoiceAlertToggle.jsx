import { Volume2, VolumeX } from 'lucide-react';
import { isSpeechSupported } from '../../utils/liveVoiceAlert';

/**
 * Interruptor "Alerta de voz en vivo" (En vivo).
 */
export function LiveVoiceAlertToggle({ enabled, onChange, lastMessage }) {
  const supported = isSpeechSupported();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Alerta de voz en vivo
        </p>
        {!supported && (
          <p className="text-[10px] text-amber-600">Tu navegador no soporta voz</p>
        )}
        {supported && lastMessage && enabled && (
          <p className="max-w-[180px] truncate text-[10px] text-gray-500" title={lastMessage}>
            {lastMessage}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={!supported}
        onClick={() => onChange?.(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          enabled ? 'bg-sky-500' : 'bg-gray-300'
        } disabled:opacity-50`}
        title={enabled ? 'Desactivar alerta de voz' : 'Activar alerta de voz'}
      >
        <span
          className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          {enabled ? (
            <Volume2 className="h-3.5 w-3.5 text-sky-600" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-gray-400" />
          )}
        </span>
      </button>
    </div>
  );
}
