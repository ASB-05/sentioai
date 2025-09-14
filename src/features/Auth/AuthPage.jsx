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
            if (isLoginView) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <h1>{isLoginView ? 'Welcome Back to SentioAI' : 'Create Your Account'}</h1>
                <p>{isLoginView ? 'Log in to explore your emotions' : 'Sign up to get started'}</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder=" "
                        />
                        <label htmlFor="email">Email</label>
                    </div>

                    <div className="input-group">
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength="6"
                            placeholder=" "
                        />
                        <label htmlFor="password">Password</label>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-auth" disabled={isLoading}>
                        {isLoading ? 'Loading...' : isLoginView ? 'Log In' : 'Sign Up'}
                    </button>
                </form>

                <div className="form-toggle">
                    {isLoginView ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button className="toggle-auth" onClick={() => setIsLoginView(!isLoginView)}>
                        {isLoginView ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
