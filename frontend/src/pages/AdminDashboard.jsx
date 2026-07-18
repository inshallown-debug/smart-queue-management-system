import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api/api.js';

const ACTION_LABEL = {
  call: 'Call next',
  serve: 'Start serving',
  complete: 'Mark done',
  skip: 'Skip (no-show)',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activeServiceId, setActiveServiceId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    const { data } = await api.get('/admin/stats');
    setStats(data);
    if (!activeServiceId && data.services.length) {
      setActiveServiceId(data.services[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServiceId]);

  const fetchQueue = useCallback(async (serviceId) => {
    if (!serviceId) return;
    const { data } = await api.get(`/admin/queue/${serviceId}`);
    setQueue(data);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchQueue(activeServiceId);

    if (!activeServiceId) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket'],
    });
    socket.emit('join-service', activeServiceId);
    socket.on('queue-updated', () => {
      fetchQueue(activeServiceId);
      fetchStats();
    });
    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServiceId]);

  async function runAction(tokenId, action) {
    setBusyId(tokenId);
    setError('');
    try {
      await api.post(`/admin/tokens/${tokenId}/${action}`);
      await fetchQueue(activeServiceId);
      await fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  const relevantQueue = queue.filter((t) => t.status !== 'cancelled');

  return (
    <div className="container">
      <div className="eyebrow">Admin</div>
      <h2>Queue dashboard</h2>

      {error && <div className="error-banner">{error}</div>}

      {stats && (
        <div className="grid-cards" style={{ marginBottom: 30 }}>
          {stats.services.map((s) => (
            <div className="stat-card" key={s.id}>
              <div className="stat-label">{s.name}</div>
              <div className="stat-number">{s.waiting}</div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                waiting · {s.completed} served today
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="tabs">
          {stats.services.map((s) => (
            <button
              key={s.id}
              className={`tab ${String(activeServiceId) === String(s.id) ? 'active' : ''}`}
              onClick={() => setActiveServiceId(s.id)}
            >
              {s.name} (Counter {s.counter_number})
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="queue-row"
          style={{ fontWeight: 700, background: 'var(--paper)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sage)' }}
        >
          <span>Token</span>
          <span>Customer</span>
          <span>Status</span>
          <span>Booked</span>
          <span>Actions</span>
        </div>

        {relevantQueue.length === 0 && <p className="center-note">No tokens booked for this service today.</p>}

        {relevantQueue.map((t) => (
          <div key={t.id} className={`queue-row ${t.status === 'serving' ? 'is-current' : ''}`}>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{t.token_number}</strong>
            <span>
              {t.customer_name}
              <div className="muted" style={{ fontSize: '0.78rem' }}>{t.email}</div>
            </span>
            <span className={`status-badge status-${t.status}`}>{t.status}</span>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="queue-actions">
              {t.status === 'waiting' && (
                <button className="btn btn-sm btn-primary" disabled={busyId === t.id} onClick={() => runAction(t.id, 'call')}>
                  {ACTION_LABEL.call}
                </button>
              )}
              {t.status === 'called' && (
                <>
                  <button className="btn btn-sm btn-dark" disabled={busyId === t.id} onClick={() => runAction(t.id, 'serve')}>
                    {ACTION_LABEL.serve}
                  </button>
                  <button className="btn btn-sm btn-outline" disabled={busyId === t.id} onClick={() => runAction(t.id, 'skip')}>
                    {ACTION_LABEL.skip}
                  </button>
                </>
              )}
              {t.status === 'serving' && (
                <button className="btn btn-sm btn-primary" disabled={busyId === t.id} onClick={() => runAction(t.id, 'complete')}>
                  {ACTION_LABEL.complete}
                </button>
              )}
              {['completed', 'skipped'].includes(t.status) && <span className="muted">—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
