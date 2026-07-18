import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/api.js';

// Shows "Now Serving" + waiting count for one service, and keeps itself
// live via a socket.io subscription (falls back gracefully if sockets
// aren't reachable — it just won't auto-refresh).
export default function LiveBoard({ serviceId, serviceName }) {
  const [live, setLive] = useState(null);
  const socketRef = useRef(null);

  async function fetchLive() {
    try {
      const { data } = await api.get(`/tokens/live/${serviceId}`);
      setLive(data);
    } catch {
      /* ignore transient errors, next poll/socket event will retry */
    }
  }

  useEffect(() => {
    if (!serviceId) return;
    fetchLive();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.emit('join-service', serviceId);
    socket.on('queue-updated', (payload) => {
      if (String(payload.serviceId) === String(serviceId)) fetchLive();
    });

    // Light polling fallback every 15s in case the socket connection drops
    const interval = setInterval(fetchLive, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  return (
    <div className="flap-board">
      <div className="flap-label">Now serving · {serviceName}</div>
      <div className="flap-number">{live?.nowServing || '—'}</div>
      <div className="flap-sub">
        <span><b>{live?.waitingCount ?? '–'}</b> waiting</span>
      </div>
    </div>
  );
}
