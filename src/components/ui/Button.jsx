export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-pollon-red text-white shadow-lg hover:bg-pollon-red-dark px-6 py-3',
    outline: 'border-2 border-pollon-red text-pollon-red hover:bg-pollon-red hover:text-white px-6 py-3',
    ghost: 'text-pollon-black hover:bg-black/5 px-4 py-2',
    dark: 'bg-pollon-black text-white hover:bg-black/80 px-6 py-3',
    wood: 'wood-texture text-pollon-wood px-6 py-3 font-bold',
  };
  return (
    <button type="button" className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
