import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/api.js';
import TokenCard from '../components/TokenCard.jsx';

export default function MyTokens() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const fetchTokens = useCallback(async () => {
    try {
      const { data } = await api.get('/tokens/my');
      setTokens(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();

    // Subscribe to live updates for every active service the user has a token in
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      tokens.forEach((t) => {
        if (['waiting', 'called', 'serving'].includes(t.status)) {
          socket.emit('join-service', t.service_id);
        }
      });
    });
    socket.on('queue-updated', fetchTokens);

    const interval = setInterval(fetchTokens, 20000);
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTokens]);

  const active = tokens.filter((t) => ['waiting', 'called', 'serving'].includes(t.status));
  const history = tokens.filter((t) => !['waiting', 'called', 'serving'].includes(t.status));

  return (
    <div className="container">
      <div className="eyebrow">Your tokens</div>
      <h2>My tokens</h2>

      {location.state?.justBooked && (
        <div className="success-banner">
          Token {location.state.justBooked.tokenNumber} booked! Scroll down to see your QR code and estimated wait.
        </div>
      )}

      {loading ? (
        <p className="center-note">Loading your tokens…</p>
      ) : (
        <>
          <h3 style={{ marginTop: 28 }}>Active</h3>
          {active.length === 0 ? (
            <p className="muted">No active tokens right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {active.map((t) => (
                <TokenCard key={t.id} token={t} />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <>
              <h3 style={{ marginTop: 36 }}>History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {history.map((t) => (
                  <TokenCard key={t.id} token={t} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
