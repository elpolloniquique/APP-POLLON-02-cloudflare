import { oemPushTips } from '../../utils/deviceOem';

/** Guía OEM para que Web Push llegue en Xiaomi/Huawei/OPPO (Chrome no debe morir). */
export function DriverOemPushGuide({ compact = false }) {
  const tips = oemPushTips();
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
      <p className="font-bold">{tips.title}</p>
      <p className="mt-1 text-xs opacity-90">
        En Xiaomi y marcas similares el sistema apaga Chrome y el aviso no llega.
        Deja Chrome y El Pollón sin ahorro de batería. Lo más seguro: app nativa de repartidor.
      </p>
      {!compact && (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
          {tips.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
