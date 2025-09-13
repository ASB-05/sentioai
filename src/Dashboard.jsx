import React, { useState } from 'react';
import { signOut } from "firebase/auth";
import { Mic, MessageSquare, Music, BarChart2, Menu, X } from 'lucide-react';

// Corrected and simplified import paths
import VoiceAnalysis from './features/VoiceAnalysis';
import AdaptiveChatbot from './features/AdaptiveChatbot';
import MoodRecommender from './features/MoodRecommender';
import SentimentDashboard from './features/SentimentDashboard';
import './Dashboard.css';

const Dashboard = ({ user, auth, db, storage }) => {
    const [activePage, setActivePage] = useState('voice');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleSignOut = () => signOut(auth).catch(e => console.error("Sign out error", e));

    const renderActivePage = () => {
        switch (activePage) {
            case 'voice': return <VoiceAnalysis user={user} db={db} storage={storage} />;
            case 'chatbot': return <AdaptiveChatbot user={user} db={db} />;
            case 'recommender': return <MoodRecommender />;
            case 'sentiment': return <SentimentDashboard db={db} />;
            default: return <VoiceAnalysis user={user} db={db} storage={storage} />;
        }
    };

    const NavLink = ({ page, icon: Icon, children }) => (
        <button onClick={() => { setActivePage(page); setIsMenuOpen(false); }} className={activePage === page ? 'active' : ''}>
            <Icon className="inline-block mr-2" size={20} />{children}
        </button>
    );

    return (
        <div id="dashboard-root">
            <div className="video-overlay"></div>
             <video className="video-bg" autoPlay loop muted playsInline key={activePage}>
                <source src="https://static.videezy.com/system/resources/previews/000/041/229/original/futuristic-plexus-background.mp4" type="video/mp4" />
            </video>

            <header className="dashboard-header">
                <div className="logo-container">
                    <h1 className="logo">SentioAI</h1>
                    <p className="tagline">because every feeling matters</p>
                </div>
                <nav className="desktop-nav">
                    <NavLink page="voice" icon={Mic}>Voice Analysis</NavLink>
                    <NavLink page="chatbot" icon={MessageSquare}>Chatbot</NavLink>
                    <NavLink page="recommender" icon={Music}>Recommender</NavLink>
                    <NavLink page="sentiment" icon={BarChart2}>Dashboard</NavLink>
                </nav>
                <div className="header-right">
                    <span className="user-email">{user.email}</span>
                    <button onClick={handleSignOut} className="btn-logout">Sign Out</button>
                    <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X/> : <Menu/>}
                    </button>
                </div>
            </header>

            <nav className={`mobile-nav ${isMenuOpen ? 'open' : ''}`}>
                <NavLink page="voice" icon={Mic}>Voice Analysis</NavLink>
                <NavLink page="chatbot" icon={MessageSquare}>Chatbot</NavLink>
                <NavLink page="recommender" icon={Music}>Recommender</NavLink>
                <NavLink page="sentiment" icon={BarChart2}>Dashboard</NavLink>
            </nav>

            <main className="main-content">
                {renderActivePage()}
            </main>
        </div>
    );
};

export default Dashboard;