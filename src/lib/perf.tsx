import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * Deferred section — only renders children when near the viewport.
 * Uses IntersectionObserver with a generous rootMargin so content
 * loads just before the user scrolls to it.
 */
export const LazySection = ({
  children,
  fallback = null,
  rootMargin = "200px",
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : 1 }}>
      {visible ? children : fallback}
    </div>
  );
};

/**
 * Prefetch a route's chunk on idle or immediately.
 * Uses requestIdleCallback where available, else setTimeout.
 */
const prefetchedRoutes = new Set<string>();

export const prefetchRoute = (loader: () => Promise<any>) => {
  const key = loader.toString();
  if (prefetchedRoutes.has(key)) return;
  prefetchedRoutes.add(key);

  const run = () => {
    loader().catch(() => {
      // silently ignore — will retry on navigation
      prefetchedRoutes.delete(key);
    });
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 100);
  }
};

/**
 * Returns onMouseEnter/onFocus handlers that prefetch a route chunk.
 * Useful for nav links on desktop.
 */
export const usePrefetchHandlers = (loader: () => Promise<any>) => ({
  onMouseEnter: () => prefetchRoute(loader),
  onFocus: () => prefetchRoute(loader),
});
