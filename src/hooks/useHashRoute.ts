import { useEffect, useState } from 'react';

export type RouteId = 'dashboard' | 'subjects' | 'tasks' | 'calendar' | 'scheduler' | 'focus' | 'ai' | 'analytics' | 'admin';

export const ROUTE_IDS: RouteId[] = ['dashboard', 'subjects', 'tasks', 'calendar', 'scheduler', 'focus', 'ai', 'analytics', 'admin'];

export const routeHref = (id: RouteId) => `#/${id}`;

function parseHash(): RouteId {
  const id = window.location.hash.replace(/^#\/?/, '') as RouteId;
  return ROUTE_IDS.includes(id) ? id : 'dashboard';
}

/** Router tối giản dựa trên location.hash – refresh trang vẫn giữ đúng màn hình, không cần thư viện ngoài. */
export function useHashRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
