import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="container">
      <div className="eyebrow">No more standing in line</div>
      <h1 style={{ fontSize: '2.6rem', maxWidth: 640 }}>
        Book your spot. Watch the queue move. Walk in right on time.
      </h1>
      <p className="muted" style={{ maxWidth: 560, fontSize: '1.05rem', marginBottom: 28 }}>
        QueueFlow gives clinics, banks, and government offices a digital token
        system — customers reserve a place from their phone, see their
        estimated wait, and get notified the moment it's their turn.
      </p>

      <div style={{ display: 'flex', gap: 14 }}>
        {!user && (
          <>
            <Link to="/register" className="btn btn-primary">Get started</Link>
            <Link to="/login" className="btn btn-outline">Log in</Link>
          </>
        )}
        {user?.role === 'customer' && (
          <>
            <Link to="/book" className="btn btn-primary">Book a token</Link>
            <Link to="/my-tokens" className="btn btn-outline">View my tokens</Link>
          </>
        )}
        {user?.role === 'admin' && (
          <Link to="/admin" className="btn btn-primary">Open admin dashboard</Link>
        )}
      </div>

      <div className="grid-cards" style={{ marginTop: 56 }}>
        <div className="card">
          <div className="eyebrow">01</div>
          <h3>Book online</h3>
          <p className="muted">Pick a service, get a token number instantly — no app install needed.</p>
        </div>
        <div className="card">
          <div className="eyebrow">02</div>
          <h3>Track the line live</h3>
          <p className="muted">See exactly who's being served and how many people are ahead of you.</p>
        </div>
        <div className="card">
          <div className="eyebrow">03</div>
          <h3>Get notified</h3>
          <p className="muted">An email/SMS alert lets you know the moment your turn is close.</p>
        </div>
      </div>
    </div>
  );
}
