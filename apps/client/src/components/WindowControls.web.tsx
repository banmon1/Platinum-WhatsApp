import { Maximize2, Minus, X } from 'lucide-react-native';
import { colors } from '../theme';

export function WindowControls() {
  if (typeof window === 'undefined' || !window.platinumDesktop?.isDesktop) return null;
  const desktop = window.platinumDesktop;
  return <div className="window-controls" data-testid="window-controls">
    <button type="button" className="window-control" aria-label="Minimize window" onClick={() => void desktop.minimize()}><Minus size={15} color={colors.ink}/></button>
    <button type="button" className="window-control" aria-label="Maximize window" onClick={() => void desktop.toggleMaximize()}><Maximize2 size={13} color={colors.ink}/></button>
    <button type="button" className="window-control window-control-close" aria-label="Close window" onClick={() => void desktop.close()}><X size={15} color={colors.ink}/></button>
  </div>;
}
