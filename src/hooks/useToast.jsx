import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, ms = 3200) => {
    setToast(message);
    setTimeout(() => setToast(null), ms);
  }, []);

  const Toast = toast ? (
    <div className="fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 animate-fade-in rounded-xl bg-pollon-black px-6 py-3 text-sm font-medium text-white shadow-2xl">
      {toast}
    </div>
  ) : null;

  return { show, Toast };
}
