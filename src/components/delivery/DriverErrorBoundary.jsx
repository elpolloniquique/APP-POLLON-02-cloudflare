import { Component } from 'react';

/**
 * Evita pantalla blanca total si un hijo del panel repartidor lanza en render.
 */
export class DriverErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Pollón] DriverErrorBoundary:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#1a1210] px-6 text-center text-white">
          <img
            src="/img/logo pollon.png"
            alt=""
            className="h-16 w-16 rounded-full border border-white/20 bg-white object-contain"
          />
          <p className="font-display text-2xl text-[#f59a3d]">El Pollón</p>
          <p className="text-sm text-white/80">Hubo un problema en el panel repartidor.</p>
          <p className="max-w-sm text-xs text-white/50">
            {String(this.state.error?.message || 'Error inesperado')}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2 rounded-xl bg-[#e85d1a] px-5 py-3 text-sm font-bold text-white"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
