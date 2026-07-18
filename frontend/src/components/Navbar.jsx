import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">Q</span>
          QueueFlow
        </Link>

        <div className="nav-links">
          {user && user.role === 'customer' && (
            <>
              <Link to="/book">Book a token</Link>
              <Link to="/my-tokens">My tokens</Link>
            </>
          )}
          {user && user.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}
        </div>

        <div className="nav-user">
          {user ? (
            <>
              <span className="pill-role">{user.role}</span>
              <span style={{ fontSize: '0.9rem' }}>{user.name}</span>
              <button className="btn-ghost-nav" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost-nav" style={{ textDecoration: 'none' }}>Log in</Link>
              <Link to="/register" className="btn-ghost-nav" style={{ textDecoration: 'none' }}>Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
