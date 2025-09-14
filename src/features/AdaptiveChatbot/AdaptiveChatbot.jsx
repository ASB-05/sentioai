import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import './AdaptiveChatbot.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const FLASK_API_URL = 'http://127.0.0.1:5000';

const AdaptiveChatbot = ({ user, db, emotion }) => {
    const [messages, setMessages] = useState([{ id: 1, text: "Hello! How are you feeling today?", sender: 'bot', emotion: 'neutral' }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const emotionEmojiMap = {
        joy: '😊', sadness: '😢', anger: '😠', optimism: '🙂',
        love: '❤️', fear: '😨', disgust: '🤢', surprise: '😲', neutral: '🤖',
        happy: '😊', sad: '😢', angry: '😠',
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessageText = input;
        const userMessage = { id: Date.now(), text: userMessageText, sender: 'user' };
        
        const botMessageId = Date.now() + 1;
        setMessages(prev => [
            ...prev,
            userMessage,
            { id: botMessageId, text: '', sender: 'bot', emotion: 'neutral' }
        ]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${FLASK_API_URL}/chat_with_emotion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessageText, emotion: emotion }),
            });

            if (!response.ok || !response.body) {
                throw new Error('Network response was not ok.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalBotText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                finalBotText += chunk; // We still build the full string for Firestore
                
                // --- THIS IS THE FIX ---
                // This state update is now self-contained.
                // It uses the previous message's text and appends the new chunk.
                setMessages(prev => prev.map(msg => 
                    msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
                ));
            }

            await addDoc(collection(db, "sentio_public_sentiment"), {
                userId: user.uid,
                email: user.email,
                analysisType: 'chat',
                userMessage: userMessageText,
                botResponse: finalBotText,
                detectedEmotion: emotion || 'text-analyzed',
                createdAt: serverTimestamp(),
            });

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => prev.map(msg =>
                msg.id === botMessageId ? { ...msg, text: "Sorry, I'm having trouble connecting. Please try again." } : msg
            ));
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
                                <span className="emotion-badge" title={`Detected Emotion: ${emotion || msg.emotion}`}>
                                    {emotionEmojiMap[emotion || msg.emotion] || '🤖'}
                                </span>
                            )}
                            {msg.text}
                            {isLoading && msg.id === messages[messages.length - 1].id && <span className="blinking-cursor"></span>}
                        </div>
                    </div>
                ))}
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