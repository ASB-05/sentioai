import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import './AdaptiveChatbot.css';

const emotionResponses = {
  happy: "I'm glad to hear that you're happy! What's got you in such a good mood?",
  sad: "I'm sorry to hear that you're feeling sad. Is there anything I can do to help?",
  angry: "It sounds like you're angry. It's okay to feel that way. What's on your mind?",
  neutral: "How are you feeling today?",
  default: "I see. Tell me more about how you're feeling."
};

const emotionKeywords = {
    happy: ['happy', 'joy', 'excited', 'great', 'good'],
    sad: ['sad', 'unhappy', 'down', 'depressed'],
    angry: ['angry', 'mad', 'furious', 'pissed'],
};

const getEmotionFromMessage = (message) => {
    const lowerCaseMessage = message.toLowerCase();
    for (const emotion in emotionKeywords) {
        if (emotionKeywords[emotion].some(keyword => lowerCaseMessage.includes(keyword))) {
            return emotion;
        }
    }
    return 'neutral';
}

const AdaptiveChatbot = ({ emotion }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How are you feeling today?", sender: 'bot', emotion: 'neutral' }
  ]);
  const [input, setInput] = useState('');
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
    if (!input.trim()) return;

    const userMessageText = input;
    const userMessage = { id: Date.now(), text: userMessageText, sender: 'user' };

    const detectedEmotion = getEmotionFromMessage(userMessageText);
    const botResponseText = emotionResponses[detectedEmotion] || emotionResponses.default;
    const botMessage = { id: Date.now() + 1, text: botResponseText, sender: 'bot', emotion: detectedEmotion };

    setMessages(prev => [
      ...prev,
      userMessage,
      botMessage
    ]);
    setInput('');
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
        />
        <button type="submit"><Send /></button>
      </form>
    </div>
  );
};

export default AdaptiveChatbot;