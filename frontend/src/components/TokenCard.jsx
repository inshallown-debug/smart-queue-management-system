import React from 'react';

const STATUS_LABEL = {
  waiting: 'Waiting',
  called: "You're called",
  serving: 'Being served',
  completed: 'Completed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export default function TokenCard({ token }) {
  const isActive = ['waiting', 'called', 'serving'].includes(token.status);

  return (
    <div className="token-card">
      <div className="token-number-big">{token.token_number || token.tokenNumber}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <strong>{token.service_name || token.serviceName}</strong>
          <span className={`status-badge status-${token.status}`}>
            {STATUS_LABEL[token.status] || token.status}
          </span>
        </div>
        <div className="muted" style={{ fontSize: '0.88rem' }}>
          Counter {token.counter_number || token.counterNumber}
          {isActive && (
            <>
              {' '}· <b>{token.peopleAhead}</b> ahead ·{' '}
              est. wait <b>{token.estimatedWaitMinutes} min</b>
            </>
          )}
        </div>
      </div>
      {token.qr_code || token.qrCode ? (
        <img
          src={token.qr_code || token.qrCode}
          alt={`QR code for token ${token.token_number || token.tokenNumber}`}
          width={72}
          height={72}
          style={{ borderRadius: 8, border: '1px solid var(--line)' }}
        />
      ) : null}
    </div>
  );
}
