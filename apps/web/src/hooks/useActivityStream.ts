'use client';

import { useEffect, useRef, useState } from 'react';
import { activityApi, type ActivityEvent } from '@/lib/api/activity';

export type ActivityTransport = 'WebSocket' | 'SSE' | 'Preview' | 'Polling';
export type ActivityConnection = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export function useActivityStream(
  companyId: string | undefined,
  initialEvents: ActivityEvent[] = [],
) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [connection, setConnection] = useState<ActivityConnection>('CONNECTING');
  const [transport, setTransport] = useState<ActivityTransport>('Polling');

  const initialEventsRef = useRef(initialEvents);
  initialEventsRef.current = initialEvents;

  useEffect(() => {
    setEvents(initialEventsRef.current);
  }, [companyId]);

  useEffect(() => {
    if (!initialEvents.length) return;
    setEvents((prev) => {
      if (prev.length === 0) return initialEvents;
      const known = new Set(prev.map((event) => event.id));
      const extras = initialEvents.filter((event) => !known.has(event.id));
      if (extras.length === 0 && prev.length >= initialEvents.length) return prev;
      return [...extras, ...prev].slice(0, 200);
    });
  }, [initialEvents]);

  useEffect(() => {
    if (!companyId) return;

    let subscribed = true;

    const prepend = (incoming: ActivityEvent) => {
      if (!incoming?.event_type || !incoming.id) return;
      setEvents((prev) => {
        if (prev.some((event) => event.id === incoming.id)) return prev;
        return [incoming, ...prev].slice(0, 200);
      });
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.add(incoming.id);
        return next;
      });
      window.setTimeout(() => {
        setFreshIds((prev) => {
          if (!prev.has(incoming.id)) return prev;
          const next = new Set(prev);
          next.delete(incoming.id);
          return next;
        });
      }, 2200);
    };

    setTransport('Polling');
    setConnection('CONNECTING');
    const refresh = async () => {
      try {
        const recent = await activityApi.getRecentActivity(companyId, { limit: 50 });
        if (!subscribed) return;
        for (const event of [...recent].reverse()) prepend(event);
        setConnection('CONNECTED');
      } catch {
        if (subscribed) setConnection('DISCONNECTED');
      }
    };
    void refresh();
    const pollId = window.setInterval(() => void refresh(), 5000);

    return () => {
      subscribed = false;
      window.clearInterval(pollId);
    };
  }, [companyId]);

  return { events, freshIds, connection, transport };
}
