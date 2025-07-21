import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export default function SupabaseSignalListener() {
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch
    supabase.from('signals').select('*').then(({ data }) => {
      if (data) setSignals(data);
    });

    // Real-time subscription
    const subscription = supabase
      .channel('public:signals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signals' },
        (payload) => {
          setSignals((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((s) => (s.id === payload.new.id ? payload.new : s));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((s) => s.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div>
      <h3>Real-Time Signals</h3>
      <ul>
        {signals.map((signal) => (
          <li key={signal.id}>
            {signal.symbol} - {signal.type} - {signal.confidence}%
          </li>
        ))}
      </ul>
    </div>
  );
} 