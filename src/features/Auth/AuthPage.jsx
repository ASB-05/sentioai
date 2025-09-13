import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import './AuthPage.css';

const AuthPage = ({ auth }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      try {
        if (isLoginView) await signInWithEmailAndPassword(auth, email, password);
        else await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) { setError(err.message); }
      finally { setIsLoading(false); }
    };

    return (
      <div className="auth-page-wrapper">
        <div className="container auth-container">
            <div className="card">
                <h1>{isLoginView ? 'Welcome Back to SentioAI' : 'Create Your Account'}</h1>
                <p>{isLoginView ? 'Log in to explore your emotions' : 'Sign up to get started'}</p>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" />
                    </div>
                    {error && <div className="error-box">{error}</div>}
                    <button type="submit" className="btn auth-btn" disabled={isLoading}>
                        {isLoading ? 'Loading...' : isLoginView ? 'Log In' : 'Sign Up'}
                    </button>
                </form>
                <div className="form-toggle">
                    {isLoginView ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button onClick={() => setIsLoginView(!isLoginView)}>
                        {isLoginView ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
};

export default AuthPage;