import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import './App.css';

// --- FIREBASE CONFIGURATION ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);


// --- AUTHENTICATION COMPONENT ---
const AuthPage = () => {
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
    <div className="container auth-container">
      <div className="card">
        <h1>{isLoginView ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{isLoginView ? 'Log in to continue' : 'Sign up to get started'}</p>
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
  );
};


// --- VOICE ANALYZER COMPONENT ---
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

const VoiceAnalyzerApp = ({ user }) => {
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [stressResponse, setStressResponse] = useState({ message: '', level: 'none' });

  // Function to determine stress level and generate a response
  const getStressResponse = (analysisResults) => {
    if (!analysisResults || analysisResults.length === 0) {
        return { message: '', level: 'none' };
    }

    const dominantEmotion = analysisResults.reduce((max, emotion) => max.score > emotion.score ? max : emotion);
    const scorePercent = dominantEmotion.score * 100;

    switch (dominantEmotion.label) {
        case 'ang': // Angry
            if (scorePercent > 60) {
                return { message: `High stress detected (${dominantEmotion.label}: ${scorePercent.toFixed(1)}%). Remember to breathe and take a moment for yourself.`, level: 'high' };
            } else if (scorePercent > 30) {
                return { message: `Moderate stress detected (${dominantEmotion.label}: ${scorePercent.toFixed(1)}%). Consider a short break.`, level: 'medium' };
            }
            break;
        case 'sad':
            if (scorePercent > 60) {
                return { message: `Signs of high sadness detected (${scorePercent.toFixed(1)}%). It's okay to not be okay. Talking to someone might help.`, level: 'high' };
            } else if (scorePercent > 30) {
                return { message: `You sound a bit down (${scorePercent.toFixed(1)}%). Be kind to yourself today.`, level: 'medium' };
            }
            break;
        case 'hap': // Happy
            if (scorePercent > 50) {
                return { message: `You sound happy and relaxed (${scorePercent.toFixed(1)}%)! Keep that positive energy going.`, level: 'low' };
            }
            break;
        case 'neu': // Neutral
            return { message: `You seem calm and composed (${scorePercent.toFixed(1)}%). A great state for focused work.`, level: 'low' };
        default:
             break;
    }
    
    return { message: `Your emotional state seems balanced. Dominant emotion: ${dominantEmotion.label} (${scorePercent.toFixed(1)}%).`, level: 'medium' };
  };

  const handleStop = async (audioBlob) => {
    setError(null);
    setResults([]);
    setStressResponse({ message: '', level: 'none' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const res = await axios.post('http://127.0.0.1:5000/analyze_voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);

      // Generate and set stress response based on results
      const response = getStressResponse(res.data);
      setStressResponse(response);

      const fileName = `recordings/${user.uid}/${Date.now()}.wav`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, audioBlob);
      const audioUrl = await getDownloadURL(storageRef);
      
      const userResultsCollection = collection(db, "users", user.uid, "analysisResults");
      await addDoc(userResultsCollection, {
        results: res.data,
        stressResponse: response,
        audioUrl: audioUrl,
        createdAt: serverTimestamp(),
      });

    } catch (err) {
      console.error("Error in processing:", err);
      setError(err.response ? err.response.data.error : 'An error occurred during processing.');
    }
  };

  const { isRecording, status, startRecording, stopRecording } = useMediaRecorder(handleStop);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const AudioVisualizer = ({ isRecording }) => (
    <div className={`visualizer ${isRecording ? 'recording' : ''}`}>
      {[...Array(5)].map((_, i) => <div className="bar" key={i}></div>)}
    </div>
  );

  return (
    <div className="container">
      <div className="header">
          <p>Welcome, <strong>{user.email}</strong></p>
          <button onClick={handleSignOut} className="btn btn-logout">Sign Out</button>
      </div>
      <div className="card">
        <h1>🎙️ Voice Emotion Detector</h1>
        <p>Press start and speak to analyze the emotion in your voice.</p>
        <AudioVisualizer isRecording={isRecording} />
        <div className="status">{status}</div>
        <div className="controls">
          <button onClick={startRecording} disabled={isRecording} className="btn btn-start">Start</button>
          <button onClick={stopRecording} disabled={!isRecording} className="btn btn-stop">Stop</button>
        </div>

        {error && <div className="error-box">Error: {error}</div>}
        
        {stressResponse.message && (
          <div className={`stress-response-box ${stressResponse.level}`}>
            {stressResponse.message}
          </div>
        )}

        {results.length > 0 && (
          <div className="results-container">
            <h2>Detailed Analysis:</h2>
            <div className="results-grid">
              {results.sort((a, b) => b.score - a.score).map((result) => (
                <div key={result.label} className="result-item">
                  <div className="label">{result.label}</div>
                  <div className="score-bar-container">
                    <div className="score-bar" style={{ width: `${result.score * 100}%` }}></div>
                  </div>
                  <div className="score">{(result.score * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
        <footer><p>Powered by Flask & React</p></footer>
    </div>
  );
};


// --- MAIN APP COMPONENT (ROUTER) ---
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
    return <div>Loading...</div>;
  }
  
  return (
      <>
        {user ? <VoiceAnalyzerApp user={user} /> : <AuthPage />}
      </>
  );
}
 
export default App;
