import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bot, Send } from 'lucide-react';
import './AdaptiveChatbot.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const FLASK_API_URL = 'http://127.0.0.1:5000';

const AdaptiveChatbot = ({ user, db }) => {
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

export default AdaptiveChatbot;