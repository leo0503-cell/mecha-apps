"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
function suscribir(cb: () => void) {
  const q = matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}
const leer = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const Escena = dynamic(() => import("./HeroEscena"), { ssr: false });
class Respaldo extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
export function HeroAnimado({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    [cargado, setCargado] = useState(false),
    [visible, setVisible] = useState(false),
    reducido = useSyncExternalStore(suscribir, leer, () => true);
  useEffect(() => {
    if (!ref.current || !matchMedia("(min-width: 768px)").matches || reducido)
      return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) timer = setTimeout(() => setCargado(true), 1500);
      },
      { threshold: 0.1 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [reducido]);
  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-[4/3] w-full max-w-md"
      aria-hidden
    >
      {cargado && !reducido ? (
        <Respaldo fallback={children}>
          <Escena visible={visible} />
        </Respaldo>
      ) : (
        children
      )}
    </div>
  );
}
