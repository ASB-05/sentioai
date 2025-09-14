import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import './AdaptiveChatbot.css';


const OPENROUTER_API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AdaptiveChatbot = ({ emotion }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! How can I help you today?" }
  ]);
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

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      
      const systemPrompt = {
        role: 'system',
        content: `You are SentioAI, a friendly and empathetic assistant. Respond with kindness and understanding. The user's currently detected emotion is: ${emotion || 'not detected'}. Adapt your tone and response to be mindful of this emotion.`
      };

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo", 
          messages: [systemPrompt, ...newMessages],
          stream: true
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Network response was not ok.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data.trim() === '[DONE]') {
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    const content = json.choices[0]?.delta?.content || '';
                    if (content) {
                         setMessages(prev =>
                            prev.map((msg, index) =>
                                index === prev.length - 1 ? { ...msg, content: msg.content + content } : msg
                            )
                        );
                    }
                } catch (error) {
                    
                }
            }
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev =>
        prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, content: "Sorry, I'm having trouble connecting. Please try again." } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="feature-card chatbot-container">
      <h1><Bot className="inline-block mr-2" /> Emotion-Adaptive Chatbot</h1>
      <p>I can adapt my responses based on your feelings. Give it a try!</p>
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role === 'user' ? 'user' : 'bot'}`}>
            <div className="message-bubble">
              {msg.role === 'assistant' && (
                <span className="emotion-badge" title={`Detected Emotion: ${emotion || 'neutral'}`}>
                  {emotionEmojiMap[emotion || 'neutral'] || '🤖'}
                </span>
              )}
              {msg.content}
              {isLoading && index === messages.length - 1 &&
                <span className="blinking-cursor"></span>}
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