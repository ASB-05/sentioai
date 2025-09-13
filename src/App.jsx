import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Mic, Bot, Send, BarChart2, Music, MessageSquare, Menu, X, Youtube, Quote } from 'lucide-react';

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

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const FLASK_API_URL = 'http://127.0.0.1:5000';

// --- AUTHENTICATION COMPONENT ---
const AuthPage = () => {
    // ... (AuthPage code remains the same as your original file)
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

// --- FEATURE: VOICE EMOTION ANALYSIS ---
const VoiceAnalysis = ({ user }) => {
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Idle. Press Start to Record.');
    
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    const drawVisualization = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteTimeDomainData(dataArray);
            
            ctx.fillStyle = 'rgba(10, 20, 40, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#3498db';
            ctx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };
        draw();
    }, []);

    const startRecording = async () => {
        setStatus('Requesting microphone permission...');
        setError(null);
        setResults([]);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Start visualization
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);
            drawVisualization();

            // Start recording
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                handleStop(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                if (audioContextRef.current) audioContextRef.current.close();
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatus('Recording... Press Stop when finished.');
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setStatus(`Error: ${err.message}. Please allow microphone access.`);
            setError(`Microphone access denied. Please enable it in your browser settings.`);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus('Processing your voice...');
        }
    };

    const handleStop = async (audioBlob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        try {
            const res = await axios.post(`${FLASK_API_URL}/analyze_voice`, formData);
            setResults(res.data);
            setStatus('Analysis complete!');

            // Save to Firebase
            const fileName = `recordings/${user.uid}/${Date.now()}.wav`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, audioBlob);
            const audioUrl = await getDownloadURL(storageRef);
            await addDoc(collection(db, "sentio_public_sentiment"), {
                userId: user.uid,
                email: user.email,
                analysisType: 'voice',
                results: res.data,
                audioUrl: audioUrl,
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error("Error processing audio:", err);
            setError(err.response?.data?.error || 'An error occurred during analysis.');
            setStatus('Error during processing.');
        }
    };

    return (
        <div className="feature-card">
            <h1><Mic className="inline-block mr-2"/> Voice Emotion Analysis</h1>
            <p>Analyze the emotion in your voice in real-time. Your voice pitch and energy are visualized below.</p>
            
            <canvas ref={canvasRef} className="voice-visualizer" width="600" height="100"></canvas>
            
            <div className="status">{status}</div>
            <div className="controls">
                <button onClick={startRecording} disabled={isRecording} className="btn btn-start">Start Recording</button>
                <button onClick={stopRecording} disabled={!isRecording} className="btn btn-stop">Stop Recording</button>
            </div>
            {error && <div className="error-box">{error}</div>}
            {results.length > 0 && (
                <div className="results-container">
                    <h2>Detailed Analysis:</h2>
                    <div className="results-grid">
                        {results.sort((a, b) => b.score - a.score).map((result) => (
                            <div key={result.label} className="result-item">
                                <div className="label">{result.label}</div>
                                <div className="score-bar-container"><div className="score-bar" style={{ width: `${result.score * 100}%` }}></div></div>
                                <div className="score">{(result.score * 100).toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- FEATURE: EMOTION-ADAPTIVE CHATBOT ---
const AdaptiveChatbot = ({ user }) => {
    const [messages, setMessages] = useState([{ id: 1, text: "Hello! How are you feeling today?", sender: 'bot', emotion: 'neutral' }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const emotionEmojiMap = {
        joy: '😊', sadness: '😢', anger: '😠', optimism: '🙂',
        love: '❤️', fear: '😨', disgust: '🤢', surprise: '😲', neutral: '🤖'
    };
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await axios.post(`${FLASK_API_URL}/chat_with_emotion`, { message: input });
            const { bot_response, detected_emotion } = res.data;
            const botMessage = { id: Date.now() + 1, text: bot_response, sender: 'bot', emotion: detected_emotion };
            setMessages(prev => [...prev, botMessage]);

            // Save interaction to Firestore
             await addDoc(collection(db, "sentio_public_sentiment"), {
                userId: user.uid,
                email: user.email,
                analysisType: 'chat',
                userMessage: input,
                botResponse: bot_response,
                detectedEmotion: detected_emotion,
                createdAt: serverTimestamp(),
            });

        } catch (error) {
            console.error("Error communicating with chatbot:", error);
            const errorMessage = { id: Date.now() + 1, text: "Sorry, I'm having trouble connecting. Please try again.", sender: 'bot', emotion: 'neutral' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="feature-card chatbot-container">
            <h1><Bot className="inline-block mr-2" /> Emotion-Adaptive Chatbot</h1>
            <p>I can adapt my responses based on your feelings. Give it a try!</p>
            <div className="chat-window">
                {messages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                        <div className="message-bubble">
                            {msg.sender === 'bot' && (
                                <span className="emotion-badge" title={`Detected Emotion: ${msg.emotion}`}>
                                    {emotionEmojiMap[msg.emotion] || '🤖'}
                                </span>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-message bot">
                        <div className="message-bubble typing-indicator">
                           <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading}><Send /></button>
            </form>
        </div>
    );
};

// --- FEATURE: MOOD-DRIVEN RECOMMENDER ---
const MoodRecommender = () => {
    const [mood, setMood] = useState('joy');
    const recommendations = {
        joy: {
            music: { title: "Happy", artist: "Pharrell Williams", link: "https://www.youtube.com/watch?v=ZbZSe6N_BXs" },
            video: { title: "Try Not To Laugh Challenge", link: "https://www.youtube.com/watch?v=F34k_t3i-c8" },
            quote: { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" }
        },
        sadness: {
            music: { title: "Fix You", artist: "Coldplay", link: "https://www.youtube.com/watch?v=k4V3Mo61fJM" },
            video: { title: "Comforting Pixar Moments", link: "https://www.youtube.com/watch?v=lV92_d_herc" },
            quote: { text: "The wound is the place where the Light enters you.", author: "Rumi" }
        },
        anger: {
            music: { title: "Weightless", artist: "Marconi Union", link: "https://www.youtube.com/watch?v=UfcAVejslrU" },
            video: { title: "10-Minute Guided Meditation for Anger", link: "https://www.youtube.com/watch?v=wkse4PPxkk4" },
            quote: { text: "For every minute you remain angry, you give up sixty seconds of peace of mind.", author: "Ralph Waldo Emerson" }
        },
        optimism: {
            music: { title: "Don't Stop Me Now", artist: "Queen", link: "https://www.youtube.com/watch?v=HgzGwKwLmgM" },
            video: { title: "Most Inspiring TED Talks", link: "https://www.youtube.com/watch?v=Dk20-E0yx_s" },
            quote: { text: "The best way to predict the future is to create it.", author: "Peter Drucker" }
        }
    };
    
    const currentRec = recommendations[mood];

    return (
        <div className="feature-card">
             <h1><Music className="inline-block mr-2" /> Mood-Driven Recommender</h1>
             <p>Select your current mood to get curated content recommendations.</p>
             <div className="mood-selector">
                <select value={mood} onChange={e => setMood(e.target.value)}>
                    <option value="joy">😊 Joyful</option>
                    <option value="sadness">😢 Sad</option>
                    <option value="anger">😠 Angry</option>
                    <option value="optimism">🙂 Optimistic</option>
                </select>
             </div>
             <div className="recommendations-grid">
                <div className="rec-card">
                    <h3><Music size={20} className="inline-block mr-2" /> Music</h3>
                    <p><strong>{currentRec.music.title}</strong> by {currentRec.music.artist}</p>
                    <a href={currentRec.music.link} target="_blank" rel="noopener noreferrer" className="btn btn-rec">Listen</a>
                </div>
                <div className="rec-card">
                    <h3><Youtube size={20} className="inline-block mr-2" /> Video</h3>
                    <p><strong>{currentRec.video.title}</strong></p>
                    <a href={currentRec.video.link} target="_blank" rel="noopener noreferrer" className="btn btn-rec">Watch</a>
                </div>
                <div className="rec-card">
                    <h3><Quote size={20} className="inline-block mr-2" /> Quote</h3>
                    <p>"{currentRec.quote.text}"</p>
                    <footer>- {currentRec.quote.author}</footer>
                </div>
             </div>
        </div>
    );
};

// --- FEATURE: GROUP SENTIMENT DASHBOARD ---
const SentimentDashboard = () => {
    const [sentimentData, setSentimentData] = useState([]);
    const [dominantMood, setDominantMood] = useState({ mood: 'N/A', emoji: '📊' });
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4757'];

    useEffect(() => {
        const q = query(collection(db, "sentio_public_sentiment"), orderBy("createdAt", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data = [];
            const moodCounter = {};

            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                const timestamp = docData.createdAt?.toDate().toLocaleTimeString() || 'N/A';
                
                let emotionLabel = 'neutral';
                let score = 0.5;

                if(docData.analysisType === 'voice' && docData.results.length > 0){
                    const topEmotion = docData.results.reduce((max, e) => e.score > max.score ? e : max);
                    emotionLabel = topEmotion.label;
                    score = topEmotion.score;
                } else if (docData.analysisType === 'chat'){
                    emotionLabel = docData.detectedEmotion;
                    score = 1.0; // Chat emotion is definitive
                }

                data.unshift({ name: timestamp, emotion: emotionLabel, score });
                moodCounter[emotionLabel] = (moodCounter[emotionLabel] || 0) + 1;
            });

            setSentimentData(data);
            
            if (Object.keys(moodCounter).length > 0) {
                const dominant = Object.keys(moodCounter).reduce((a, b) => moodCounter[a] > moodCounter[b] ? a : b);
                const emojiMap = { joy: '⚡', sadness: '😟', anger: '😡', optimism: '🙂', hap: '😊', ang: '😠', sad: '😢', neu: '😐' };
                setDominantMood({ mood: dominant, emoji: emojiMap[dominant] || '📊' });
            }
        });

        return () => unsubscribe();
    }, []);

    const pieData = Object.entries(
        sentimentData.reduce((acc, curr) => {
            acc[curr.emotion] = (acc[curr.emotion] || 0) + 1;
            return acc;
        }, {})
    ).map(([name, value]) => ({ name, value }));

    return (
        <div className="feature-card sentiment-dashboard">
            <h1><BarChart2 className="inline-block mr-2" /> Group Sentiment Dashboard</h1>
            <p>Real-time emotional state of all users interacting with SentioAI.</p>
            <div className="dominant-mood-indicator">
                <h2>Dominant Group Mood</h2>
                <div className="mood-display">
                    <span className="mood-emoji">{dominantMood.emoji}</span>
                    <span className="mood-text">{dominantMood.mood}</span>
                </div>
            </div>
            <div className="charts-container">
                <div className="chart-wrapper">
                    <h3>Recent Emotion Timeline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={sentimentData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                            <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.7)" />
                            <YAxis domain={[0, 1]} hide={true} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}/>
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#8884d8" name="Emotion Intensity" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="chart-wrapper">
                     <h3>Emotion Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                             <Tooltip contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD LAYOUT ---
const Dashboard = ({ user }) => {
    const [activePage, setActivePage] = useState('voice');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const handleSignOut = () => signOut(auth).catch(e => console.error("Sign out error", e));

    const renderActivePage = () => {
        switch (activePage) {
            case 'voice': return <VoiceAnalysis user={user} />;
            case 'chatbot': return <AdaptiveChatbot user={user} />;
            case 'recommender': return <MoodRecommender />;
            case 'sentiment': return <SentimentDashboard />;
            default: return <VoiceAnalysis user={user} />;
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

// --- TOP-LEVEL APP COMPONENT ---
function App() {
  const [user, setUser] = useState(null);
  const [authIsReady, setAuthIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (_user) => {
      setUser(_user);
      setAuthIsReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authIsReady) {
    return <div className="loading-screen">Loading SentioAI...</div>;
  }
  
  return user ? <Dashboard user={user} /> : <AuthPage />;
}
 
export default App;
