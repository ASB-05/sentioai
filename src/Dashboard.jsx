import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Smile, Frown, Angry, Meh, BarChart2, TrendingUp, Mic } from 'lucide-react';


// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);


// --- UI Component ---
const DashboardUI = ({
    user,
    activePage,
    setActivePage,
    isMenuOpen,
    setIsMenuOpen,
    currentVideoIndex,
    handleSignOut,
    renderActivePage,
    handleVideoEnd
}) => {

    const videoSources = [
        'https://static.videezy.com/system/resources/previews/000/043/305/original/Geometric_Lines_Background_4K.mp4',
        'https://static.videezy.com/system/resources/previews/000/043/469/original/Sound_Wave_Background_4K.mp4',
        'https://static.videezy.com/system/resources/previews/000/043/307/original/Plexus_Network_Background.mp4',
        'https://static.videezy.com/system/resources/previews/000/041/229/original/futuristic-plexus-background.mp4',
        'https://static.videezy.com/system/resources/previews/000/043/437/original/Blue_Glowing_Lines_Background.mp4',
        'https://static.videezy.com/system/resources/previews/000/043/386/original/Gradient_Waves_Background.mp4'
    ];

    const navLinks = (
        <>
            <a href="#voice" onClick={(e) => { e.preventDefault(); setActivePage('voice'); setIsMenuOpen(false); }} className={activePage === 'voice' ? 'active' : ''}>Voice Emotion Detection</a>
            <a href="#chatbot" onClick={(e) => { e.preventDefault(); setActivePage('chatbot'); setIsMenuOpen(false); }} className={activePage === 'chatbot' ? 'active' : ''}>Emotion-Adaptive Chatbot</a>
            <a href="#songs" onClick={(e) => { e.preventDefault(); setActivePage('songs'); setIsMenuOpen(false); }} className={activePage === 'songs' ? 'active' : ''}>Song Recommendation</a>
            <a href="#dashboard" onClick={(e) => { e.preventDefault(); setActivePage('dashboard'); setIsMenuOpen(false); }} className={activePage === 'dashboard' ? 'active' : ''}>Sentiment Dashboard</a>
        </>
    );

    return (
        <>
            <style>{`
                /* --- Dashboard Specific Styles --- */
                #dashboard-root { width: 100vw; height: 100vh; overflow: hidden; position: relative; color: white; display: flex; flex-direction: column; }
                .video-bg { position: fixed; top: 50%; left: 50%; min-width: 100%; min-height: 100%; width: auto; height: auto; z-index: -2; transform: translateX(-50%) translateY(-50%); }
                .video-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(10, 20, 40, 0.8); backdrop-filter: blur(5px); z-index: -1; }
                .dashboard-header { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background-color: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0; }
                .logo-container { text-align: left; }
                .logo { font-size: 1.8rem; font-weight: 700; margin: 0; color: #fff; }
                .tagline { font-size: 0.9rem; margin: 0; color: rgba(255, 255, 255, 0.7); }
                .desktop-nav { display: flex; gap: 30px; }
                .desktop-nav a { color: rgba(255, 255, 255, 0.8); text-decoration: none; font-weight: 600; transition: all 0.2s ease-in-out; padding-bottom: 5px; border-bottom: 2px solid transparent; }
                .desktop-nav a:hover, .desktop-nav a.active { color: #fff; border-bottom: 2px solid #3498db; }
                .header-right { display: flex; align-items: center; gap: 20px; }
                .user-email { font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); }
                .btn-logout { background: transparent; color: #ff4757; border: 1px solid #ff4757; padding: 8px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease-in-out; }
                .btn-logout:hover { background: #ff4757; color: white; }
                .hamburger { display: none; background: none; border: none; cursor: pointer; z-index: 1001; }
                .hamburger .bar { display: block; width: 25px; height: 3px; margin: 5px auto; background-color: white; transition: all 0.3s ease-in-out; }
                .mobile-nav { position: fixed; top: 0; right: -100%; width: 70%; max-width: 300px; height: 100%; background-color: rgba(20, 30, 50, 0.98); backdrop-filter: blur(10px); z-index: 1000; transition: right 0.3s ease-in-out; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
                .mobile-nav.open { right: 0; }
                .mobile-nav a { color: #fff; text-decoration: none; font-size: 1.2rem; font-weight: 600; }
                .main-content { flex-grow: 1; padding: 40px; overflow-y: auto; display: flex; justify-content: center; align-items: start; }
                .feature-card { background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 32px; width: 100%; max-width: 700px; color: #fff; text-align: center; }
                .feature-card p { color: rgba(255, 255, 255, 0.8); }

                /* --- Sentiment Dashboard Styles --- */
                .sentiment-dashboard { display: flex; flex-direction: column; gap: 30px; width: 100%; max-width: 1200px; color: #fff; }
                .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                .summary-card { background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
                .summary-card .icon { margin-bottom: 10px; color: #3498db; }
                .summary-card h3 { margin: 0; font-size: 1.1rem; color: rgba(255, 255, 255, 0.8); }
                .summary-card p { margin: 0; font-size: 2rem; font-weight: 700; color: #fff; }
                .chart-container { background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; }
                .chart-container h3 { margin-top: 0; text-align: center; }
                .recharts-wrapper { font-size: 12px; }
                .recharts-tooltip-wrapper { background: #333 !important; border: 1px solid #555 !important; border-radius: 5px !important; }
                .loading-container, .no-data-container { text-align: center; margin-top: 50px; }

                @media (max-width: 1024px) {
                    .desktop-nav { display: none; }
                    .hamburger { display: block; }
                    .dashboard-header { padding: 15px 20px; }
                    .main-content { padding: 20px; }
                }
            `}</style>
            <div id="dashboard-root">
                <video className="video-bg" key={currentVideoIndex} onEnded={handleVideoEnd} autoPlay muted playsInline>
                    <source src={videoSources[currentVideoIndex]} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
                <div className="video-overlay"></div>
                
                <header className="dashboard-header">
                    <div className="logo-container">
                        <h1 className="logo">SentioAI</h1>
                        <p className="tagline">because Every Feeling matters</p>
                    </div>
                    <nav className="desktop-nav">{navLinks}</nav>
                    <div className="header-right">
                         <span className="user-email">{user.email}</span>
                        <button onClick={handleSignOut} className="btn-logout">Sign Out</button>
                        <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                        </button>
                    </div>
                </header>
                <nav className={`mobile-nav ${isMenuOpen ? 'open' : ''}`}>{navLinks}</nav>
                
                <main className="main-content">
                    {renderActivePage()}
                </main>
            </div>
        </>
    );
};


// --- HOOKS AND FEATURE COMPONENTS ---
const useMediaRecorder = (onStop) => {
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('idle');
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        setStatus('Requesting permission...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStatus('Recording...');
            setIsRecording(true);
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                onStop(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                setStatus('idle');
            };
            mediaRecorder.start();
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setStatus(`Error: ${err.message}. Please allow microphone access.`);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus('Processing...');
        }
    };

    return { isRecording, status, startRecording, stopRecording };
};

const VoiceEmotionDetection = ({ user }) => {
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [stressResponse, setStressResponse] = useState({ message: '', level: 'none' });

  const getStressResponse = (analysisResults) => {
    if (!analysisResults || analysisResults.length === 0) return { message: '', level: 'none' };
    const dominantEmotion = analysisResults.reduce((max, emotion) => max.score > emotion.score ? max : emotion);
    const scorePercent = dominantEmotion.score * 100;

    switch (dominantEmotion.label) {
        case 'ang':
            if (scorePercent > 60) return { message: `High stress detected (${dominantEmotion.label}: ${scorePercent.toFixed(1)}%). Remember to breathe.`, level: 'high' };
            if (scorePercent > 30) return { message: `Moderate stress detected (${dominantEmotion.label}: ${scorePercent.toFixed(1)}%). Consider a short break.`, level: 'medium' };
            break;
        case 'sad':
            if (scorePercent > 60) return { message: `Signs of high sadness detected (${scorePercent.toFixed(1)}%). It's okay to not be okay.`, level: 'high' };
            if (scorePercent > 30) return { message: `You sound a bit down (${scorePercent.toFixed(1)}%). Be kind to yourself today.`, level: 'medium' };
            break;
        case 'hap':
            if (scorePercent > 50) return { message: `You sound happy and relaxed (${scorePercent.toFixed(1)}%)! Keep that positive energy going.`, level: 'low' };
            break;
        case 'neu':
            return { message: `You seem calm and composed (${scorePercent.toFixed(1)}%). A great state for focused work.`, level: 'low' };
        default: break;
    }
    return { message: `Your emotional state seems balanced. Dominant emotion: ${dominantEmotion.label} (${scorePercent.toFixed(1)}%).`, level: 'medium' };
  };

  const handleStop = async (audioBlob) => {
    setError(null); setResults([]); setStressResponse({ message: '', level: 'none' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const res = await axios.post('http://127.0.0.1:5000/analyze_voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResults(res.data);
      const response = getStressResponse(res.data);
      setStressResponse(response);

      const fileName = `recordings/${user.uid}/${Date.now()}.wav`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, audioBlob);
      const audioUrl = await getDownloadURL(storageRef);
      
      const userResultsCollection = collection(db, "users", user.uid, "analysisResults");
      await addDoc(userResultsCollection, { results: res.data, stressResponse: response, audioUrl: audioUrl, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("Error in processing:", err);
      setError(err.response ? err.response.data.error : 'An error occurred during processing.');
    }
  };

  const { isRecording, status, startRecording, stopRecording } = useMediaRecorder(handleStop);
  const AudioVisualizer = ({ isRecording }) => ( <div className={`visualizer ${isRecording ? 'recording' : ''}`}>{ [...Array(5)].map((_, i) => <div className="bar" key={i}></div>) }</div> );

  return (
    <div className="feature-card">
      <h1>🎙️ Voice Emotion Detector</h1>
      <p>Press start and speak to analyze the emotion in your voice.</p>
      <AudioVisualizer isRecording={isRecording} />
      <div className="status">{status}</div>
      <div className="controls"><button onClick={startRecording} disabled={isRecording} className="btn btn-start">Start</button><button onClick={stopRecording} disabled={!isRecording} className="btn btn-stop">Stop</button></div>
      {error && <div className="error-box">Error: {error}</div>}
      {stressResponse.message && ( <div className={`stress-response-box ${stressResponse.level}`}>{stressResponse.message}</div> )}
      {results.length > 0 && (
        <div className="results-container">
          <h2>Detailed Analysis:</h2>
          <div className="results-grid">{results.sort((a, b) => b.score - a.score).map((result) => ( <div key={result.label} className="result-item"><div className="label">{result.label}</div><div className="score-bar-container"><div className="score-bar" style={{ width: `${result.score * 100}%` }}></div></div><div className="score">{(result.score * 100).toFixed(1)}%</div></div> ))}</div>
        </div>
      )}
    </div>
  );
};

const EmotionAdaptiveChatbot = () => ( <div className="feature-card"><h1>💬 Emotion-Adaptive Chatbot</h1><p>This feature is coming soon!</p></div> );
const SongRecommendationSystem = () => ( <div className="feature-card"><h1>🎵 Song Recommendation System</h1><p>This feature is coming soon!</p></div> );
  const emotionMap = { angry: 'Angry', sad: 'Sad', happy: 'Happy', neutral: 'Neutral' };
    const emotionColors = { Happy: '#28a745', Sad: '#007bff', Angry: '#dc3545', Neutral: '#6c757d' };
// --- NEW SENTIMENT DASHBOARD COMPONENT ---
const SentimentDashboard = ({ user }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

  

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const resultsCollection = collection(db, "users", user.uid, "analysisResults");
                const q = query(resultsCollection, orderBy("createdAt", "asc"));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    setData({ summary: null, trend: [] });
                    setLoading(false);
                    return;
                }

                const docs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

                // Process data for trend chart
                const trendData = docs.map(doc => {
                    const entry = { date: new Date(doc.createdAt.seconds * 1000).toLocaleDateString() };
                    doc.results.forEach(res => {
                        entry[emotionMap[res.label]] = (res.score * 100).toFixed(2);
                    });
                    return entry;
                });

                // Process data for summary and bar chart
                const emotionTotals = { Angry: 0, Sad: 0, Happy: 0, Neutral: 0 };
                docs.forEach(doc => {
                    doc.results.forEach(res => {
                        emotionTotals[emotionMap[res.label]] += res.score;
                    });
                });

                const dominantEmotion = Object.keys(emotionTotals).reduce((a, b) => emotionTotals[a] > emotionTotals[b] ? a : b);
                
                const averageData = Object.keys(emotionTotals).map(key => ({
                    name: key,
                    Average: ((emotionTotals[key] / docs.length) * 100).toFixed(2)
                }));
                
                setData({
                    summary: {
                        totalAnalyses: docs.length,
                        dominantEmotion: dominantEmotion,
                    },
                    barChart: averageData,
                    trend: trendData
                });

            } catch (err) {
                console.error("Error fetching sentiment data:", err);
                setError("Failed to load your sentiment data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (loading) return <div className="loading-container"><h2>Loading Dashboard...</h2></div>;
    if (error) return <div className="error-box">{error}</div>;
    if (!data || !data.summary) {
        return (
            <div className="no-data-container feature-card">
                <h1>📊 Sentiment Dashboard</h1>
                <p>No data available yet. Use the Voice Emotion Detection feature to get started!</p>
            </div>
        );
    }

    return (
        <div className="sentiment-dashboard">
            <h1>Your Sentiment Dashboard</h1>
            <div className="summary-cards">
                <div className="summary-card">
                    <Mic size={40} className="icon" />
                    <h3>Total Analyses</h3>
                    <p>{data.summary.totalAnalyses}</p>
                </div>
                <div className="summary-card">
                    {data.summary.dominantEmotion === 'Happy' && <Smile size={40} className="icon" />}
                    {data.summary.dominantEmotion === 'Sad' && <Frown size={40} className="icon" />}
                    {data.summary.dominantEmotion === 'Angry' && <Angry size={40} className="icon" />}
                    {data.summary.dominantEmotion === 'Neutral' && <Meh size={40} className="icon" />}
                    <h3>Dominant Emotion</h3>
                    <p>{data.summary.dominantEmotion}</p>
                </div>
            </div>

            <div className="chart-container">
                <h3><BarChart2 size={20} style={{verticalAlign: 'middle', marginRight: '10px'}}/>Average Emotion Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.barChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                        <XAxis dataKey="name" stroke="#fff" />
                        <YAxis stroke="#fff" unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} labelStyle={{ color: '#fff' }}/>
                        <Legend />
                        <Bar dataKey="Average" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="chart-container">
                <h3><TrendingUp size={20} style={{verticalAlign: 'middle', marginRight: '10px'}}/>Emotion Trends Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.trend}>
                         <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                        <XAxis dataKey="date" stroke="#fff" />
                        <YAxis stroke="#fff" unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} labelStyle={{ color: '#fff' }}/>
                        <Legend />
                        {Object.keys(emotionColors).map(key => (
                           <Line key={key} type="monotone" dataKey={key} stroke={emotionColors[key]} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


// --- Main Dashboard Container Component (LOGIC) ---
const Dashboard = ({ user }) => {
    const [activePage, setActivePage] = useState('voice');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };
    
    const renderActivePage = () => {
        switch (activePage) {
            case 'voice': return <VoiceEmotionDetection user={user} />;
            case 'chatbot': return <EmotionAdaptiveChatbot />;
            case 'songs': return <SongRecommendationSystem />;
            case 'dashboard': return <SentimentDashboard user={user} />;
            default: return <VoiceEmotionDetection user={user} />;
        }
    };

    const handleVideoEnd = () => {
        const videoSources = [
            'https://static.videezy.com/system/resources/previews/000/043/305/original/Geometric_Lines_Background_4K.mp4',
            'https://static.videezy.com/system/resources/previews/000/043/469/original/Sound_Wave_Background_4K.mp4',
            'https://static.videezy.com/system/resources/previews/000/043/307/original/Plexus_Network_Background.mp4',
            'https://static.videezy.com/system/resources/previews/000/041/229/original/futuristic-plexus-background.mp4',
            'https://static.videezy.com/system/resources/previews/000/043/437/original/Blue_Glowing_Lines_Background.mp4',
            'https://static.videezy.com/system/resources/previews/000/043/386/original/Gradient_Waves_Background.mp4'
        ];
        setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videoSources.length);
    };

    return (
        <DashboardUI
            user={user}
            activePage={activePage}
            setActivePage={setActivePage}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            currentVideoIndex={currentVideoIndex}
            handleSignOut={handleSignOut}
            renderActivePage={renderActivePage}
            handleVideoEnd={handleVideoEnd}
        />
    );
};

export default Dashboard;

