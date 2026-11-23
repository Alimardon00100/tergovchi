import { useReducedMotion } from 'framer-motion';
import { useUi } from '../../app/store';
export function useQuietMotion() {
  const system = useReducedMotion();
  const preference = useUi((state) => state.reducedMotion);
  return !!system || preference;
}
