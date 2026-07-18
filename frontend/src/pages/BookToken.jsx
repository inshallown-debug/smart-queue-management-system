import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import LiveBoard from '../components/LiveBoard.jsx';

export default function BookToken() {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/services').then(({ data }) => {
      setServices(data);
      if (data.length) setSelected(String(data[0].id));
    });
  }, []);

  async function handleBook() {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/tokens', { serviceId: selected });
      navigate('/my-tokens', { state: { justBooked: data } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not book a token. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const selectedService = services.find((s) => String(s.id) === selected);

  return (
    <div className="container">
      <div className="eyebrow">Book a token</div>
      <h2>Choose a service</h2>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          {error && <div className="error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="service">Service</label>
            <select id="service" value={selected || ''} onChange={(e) => setSelected(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — Counter {s.counter_number}
                </option>
              ))}
            </select>
          </div>

          {selectedService && (
            <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 20 }}>
              Average handling time: ~{selectedService.avg_service_minutes} minutes per person.
            </p>
          )}

          <button className="btn btn-primary btn-block" onClick={handleBook} disabled={loading || !selected}>
            {loading ? 'Booking…' : 'Book my token'}
          </button>
        </div>

        {selectedService && (
          <LiveBoard serviceId={selectedService.id} serviceName={selectedService.name} />
        )}
      </div>
    </div>
  );
}
