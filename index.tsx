import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

// Ensure process.env.API_KEY is available in the environment where this code runs.
declare var process: {
  env: {
    API_KEY: string;
  };
};

// Helper function to markdown to JSX (simplified for this example)
const renderMarkdown = (markdown: string) => {
  if (!markdown) return null;
  // Basic markdown to JSX conversion for bold, italics, links, and paragraphs
  let html = markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // Links
    .replace(/\n/g, '<br />'); // Newlines to <br>
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

interface Message {
  text: string;
  sender: 'user' | 'model';
}

const ChatComponent: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initializeChat = useCallback(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      chatRef.current = ai.chats.create({
        model: 'gemini-3-pro-preview', // Complex text tasks
        config: {
          systemInstruction: 'You are a friendly and engaging storyteller. You focus on crafting imaginative narratives and encouraging the user to explore story possibilities.',
        },
      });
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      setMessages((prev) => [
        ...prev,
        { text: "Error initializing chat. Please try again.", sender: "model" },
      ]);
    }
  }, []);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        await initializeChat(); // Re-initialize if chatRef is null
        if (!chatRef.current) throw new Error("Chat not initialized.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentChat = ai.chats.create({ // Re-create chat to ensure latest API key is used
        model: 'gemini-3-pro-preview',
        config: chatRef.current.config, // Maintain previous config
        history: chatRef.current.history, // Maintain previous history
      });
      chatRef.current = currentChat;

      const streamResponse = await currentChat.sendMessageStream({ message: input });
      let fullResponseText = '';
      for await (const chunk of streamResponse) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponseText += c.text;
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.sender === 'model' && lastMessage.text === '') {
              // Update existing partial message
              return [...prev.slice(0, -1), { ...lastMessage, text: fullResponseText }];
            } else {
              // Add a new message if it's the first chunk or previous was complete
              return [...prev, { text: fullResponseText, sender: 'model' }];
            }
          });
        }
      }
      setMessages((prev) => {
        // Ensure the last message is the complete one
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.sender === 'model') {
          return [...prev.slice(0, -1), { ...lastMessage, text: fullResponseText }];
        }
        return prev;
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          text: `Error: Failed to get response. ${error instanceof Error ? error.message : String(error)}`,
          sender: 'model',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.length === 0 && !isLoading && (
          <div className="initial-message">Start a story with Gemini 3 Pro!</div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {renderMarkdown(msg.text)}
          </div>
        ))}
        {isLoading && (
          <div className="message model loading">
            <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tell me a story about..."
          disabled={isLoading}
          aria-label="Chat input"
        />
        <button onClick={sendMessage} disabled={isLoading} aria-label="Send message">
          Send
        </button>
      </div>
    </div>
  );
};

const moods = [
  { value: 'rebellious', label: 'Rebellious' },
  { value: 'calm', label: 'Calm' },
  { value: 'adventurous', label: 'Adventurous' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'joyful', label: 'Joyful' },
  { value: 'melancholy', label: 'Melancholy' },
];

const CreativeGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedMood, setSelectedMood] = useState('rebellious');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const generateCreativeContent = async () => {
    if (prompt.trim() === '' || isLoading) return;

    setIsLoading(true);
    setError('');
    setGeneratedText('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are a creative writer. Generate content in a ${selectedMood} mood. The output should be engaging and reflect the chosen mood.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Fast text tasks, suitable for creative generation
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.9,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 500, // Limit output for faster responses
        },
      });

      setGeneratedText(response.text || 'No content generated.');
    } catch (err) {
      console.error('Error generating creative content:', err);
      setError(`Failed to generate content: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="creative-generator-container">
      <div className="input-section">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your idea for a story, poem, or scene..."
          rows={5}
          disabled={isLoading}
          aria-label="Creative prompt input"
        />
        <div className="controls">
          <label htmlFor="mood-select" className="sr-only">Select Mood:</label>
          <select
            id="mood-select"
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value)}
            disabled={isLoading}
            aria-label="Select creative mood"
          >
            {moods.map((mood) => (
              <option key={mood.value} value={mood.value}>
                {mood.label}
              </option>
            ))}
          </select>
          <button onClick={generateCreativeContent} disabled={isLoading} aria-label="Generate creative content">
            Generate
          </button>
        </div>
      </div>
      <div className="output-section">
        {isLoading && (
          <div className="loading-indicator">
            <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span> Generating...
          </div>
        )}
        {error && <div className="error-message" role="alert">{error}</div>}
        {!isLoading && generatedText && (
          <div className="generated-content">
            <h3>Your Tale:</h3>
            {renderMarkdown(generatedText)}
          </div>
        )}
        {!isLoading && !generatedText && !error && (
            <div className="placeholder-message">Your generated story will appear here.</div>
        )}
      </div>
    </div>
  );
};


const StoriesInTheSky: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'mood-weaver'>('chat');

  return (
    <div className="stories-in-the-sky">
      <header className="app-header">
        <h1>Stories in the Sky</h1>
        <nav className="tabs" role="tablist">
          <button
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
            role="tab"
            aria-selected={activeTab === 'chat'}
            aria-controls="chat-panel"
            id="chat-tab"
          >
            Storyteller Chat
          </button>
          <button
            className={activeTab === 'mood-weaver' ? 'active' : ''}
            onClick={() => setActiveTab('mood-weaver')}
            role="tab"
            aria-selected={activeTab === 'mood-weaver'}
            aria-controls="mood-weaver-panel"
            id="mood-weaver-tab"
          >
            Mood Weaver
          </button>
        </nav>
      </header>

      <main className="tab-content">
        <div
          id="chat-panel"
          role="tabpanel"
          aria-labelledby="chat-tab"
          hidden={activeTab !== 'chat'}
          className="panel"
        >
          <ChatComponent />
        </div>
        <div
          id="mood-weaver-panel"
          role="tabpanel"
          aria-labelledby="mood-weaver-tab"
          hidden={activeTab !== 'mood-weaver'}
          className="panel"
        >
          <CreativeGenerator />
        </div>
      </main>

      {/* Global Styles */}
      <style jsx global>{`
        :root {
          --bg-color: #0d1117;
          --text-color: #c9d1d9;
          --primary-color: #58a6ff;
          --secondary-color: #8b949e;
          --border-color: #30363d;
          --chat-user-bg: #21262d;
          --chat-model-bg: #161b22;
          --button-hover-bg: #1f6feb;
          --active-tab-bg: #161b22;
        }

        body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-color);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 100vh;
          padding: 20px;
          box-sizing: border-box;
        }

        #root {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stories-in-the-sky {
          background-color: #161b22; /* Darker background for the main app container */
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 700px; /* Minimum height for the app */
        }

        .app-header {
          background-color: #0d1117;
          padding: 20px 30px;
          border-bottom: 1px solid var(--border-color);
          text-align: center;
          position: relative;
        }

        .app-header h1 {
          margin: 0;
          color: var(--primary-color);
          font-size: 2.2em;
          text-shadow: 0 0 8px rgba(88, 166, 255, 0.4);
          font-weight: 600;
        }

        .tabs {
          display: flex;
          justify-content: center;
          margin-top: 15px;
          border-radius: 8px;
          overflow: hidden;
        }

        .tabs button {
          background-color: var(--chat-model-bg);
          color: var(--secondary-color);
          border: none;
          padding: 12px 25px;
          cursor: pointer;
          font-size: 1em;
          font-weight: 500;
          transition: background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
          flex-grow: 1;
          text-align: center;
          outline: none;
        }

        .tabs button:hover:not(.active) {
          background-color: #1f2732;
          color: var(--text-color);
        }

        .tabs button.active {
          background-color: var(--primary-color);
          color: var(--bg-color);
          font-weight: 700;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.3);
        }

        .tab-content {
          flex-grow: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative; /* For absolute positioning of panels */
        }

        .panel {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          opacity: 1;
          transition: opacity 0.3s ease-in-out;
        }

        .panel[hidden] {
          display: none;
          opacity: 0;
        }

        /* Chat Component */
        .chat-container {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          min-height: 500px; /* Ensure chat container has height */
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          background-color: var(--bg-color);
        }

        .messages {
          flex-grow: 1;
          padding: 15px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          scroll-behavior: smooth;
        }

        .initial-message {
          text-align: center;
          color: var(--secondary-color);
          padding: 20px;
          font-style: italic;
        }

        .message {
          max-width: 80%;
          padding: 10px 15px;
          border-radius: 18px;
          line-height: 1.5;
          word-wrap: break-word;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }

        .message.user {
          align-self: flex-end;
          background-color: var(--primary-color);
          color: var(--bg-color);
          border-bottom-right-radius: 4px;
        }

        .message.model {
          align-self: flex-start;
          background-color: var(--chat-model-bg);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 4px;
        }

        .message.model.loading {
          background-color: var(--chat-model-bg);
          color: var(--secondary-color);
          font-style: italic;
          display: inline-flex;
          align-items: center;
        }

        .message.model.loading .dot {
          animation: blink 1s infinite steps(1, start);
        }
        .message.model.loading .dot:nth-child(1) { animation-delay: 0s; }
        .message.model.loading .dot:nth-child(2) { animation-delay: 0.3s; }
        .message.model.loading .dot:nth-child(3) { animation-delay: 0.6s; }

        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        .message a {
          color: var(--primary-color);
          text-decoration: underline;
        }

        .message strong {
          font-weight: 700;
        }

        .message em {
          font-style: italic;
        }

        .input-area {
          display: flex;
          padding: 15px;
          border-top: 1px solid var(--border-color);
          background-color: var(--bg-color);
          gap: 10px;
        }

        .input-area input {
          flex-grow: 1;
          padding: 12px 15px;
          border-radius: 25px;
          border: 1px solid var(--border-color);
          background-color: #21262d;
          color: var(--text-color);
          font-size: 1em;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .input-area input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
        }

        .input-area input::placeholder {
          color: var(--secondary-color);
        }

        .input-area button {
          background-color: var(--primary-color);
          color: var(--bg-color);
          border: none;
          border-radius: 25px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 1em;
          font-weight: 600;
          transition: background-color 0.3s ease, transform 0.2s ease;
          outline: none;
        }

        .input-area button:hover:not(:disabled) {
          background-color: var(--button-hover-bg);
          transform: translateY(-1px);
        }

        .input-area button:disabled {
          background-color: #4a5461;
          cursor: not-allowed;
        }

        /* Creative Generator Component */
        .creative-generator-container {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          gap: 20px;
          min-height: 500px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background-color: var(--bg-color);
          padding: 20px;
        }

        .creative-generator-container .input-section {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .creative-generator-container textarea {
          width: 100%;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: #21262d;
          color: var(--text-color);
          font-size: 1em;
          resize: vertical;
          min-height: 120px;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .creative-generator-container textarea:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
        }

        .creative-generator-container textarea::placeholder {
          color: var(--secondary-color);
        }

        .creative-generator-container .controls {
          display: flex;
          gap: 15px;
          align-items: center;
          flex-wrap: wrap;
        }

        .creative-generator-container select {
          padding: 10px 15px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: #21262d;
          color: var(--text-color);
          font-size: 1em;
          appearance: none; /* Remove default arrow */
          background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23c9d1d9%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-6.5%200-12.3%203.2-16.1%208.1-3.8%204.9-3.9%2011.6-1.5%2017.7l131.8%20188c3.8%205.1%209.6%208.2%2016.2%208.2s12.4-3.1%2016.2-8.2l131.9-188c2.4-6.2%202.3-12.8-1.5-17.7z%22%2F%3E%3C%2Fsvg%3E');
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 12px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .creative-generator-container select:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
        }

        .creative-generator-container button {
          background-color: var(--primary-color);
          color: var(--bg-color);
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 1em;
          font-weight: 600;
          transition: background-color 0.3s ease, transform 0.2s ease;
          outline: none;
        }

        .creative-generator-container button:hover:not(:disabled) {
          background-color: var(--button-hover-bg);
          transform: translateY(-1px);
        }

        .creative-generator-container button:disabled {
          background-color: #4a5461;
          cursor: not-allowed;
        }

        .creative-generator-container .output-section {
          flex-grow: 1;
          background-color: #161b22;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center; /* Center content horizontally */
          justify-content: center; /* Center content vertically initially */
          text-align: left;
        }

        .creative-generator-container .output-section.has-content {
          justify-content: flex-start; /* Align to top if content exists */
        }

        .loading-indicator {
          color: var(--secondary-color);
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .loading-indicator .dot {
          animation: blink 1s infinite steps(1, start);
        }
        .loading-indicator .dot:nth-child(1) { animation-delay: 0s; }
        .loading-indicator .dot:nth-child(2) { animation-delay: 0.3s; }
        .loading-indicator .dot:nth-child(3) { animation-delay: 0.6s; }


        .error-message {
          color: #ff7b72;
          background-color: #3b1e22;
          padding: 10px 15px;
          border-radius: 8px;
          border: 1px solid #ff7b72;
        }

        .generated-content {
          width: 100%;
        }

        .generated-content h3 {
          color: var(--primary-color);
          margin-top: 0;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }

        .generated-content a {
          color: var(--primary-color);
          text-decoration: underline;
        }

        .generated-content strong {
          font-weight: 700;
        }

        .generated-content em {
          font-style: italic;
        }

        .placeholder-message {
          color: var(--secondary-color);
          font-style: italic;
          text-align: center;
          padding: 20px;
        }

        /* Screen reader only class */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .app-header {
            padding: 15px 20px;
          }
          .app-header h1 {
            font-size: 1.8em;
          }
          .tabs button {
            padding: 10px 15px;
            font-size: 0.9em;
          }
          .tab-content {
            padding: 15px;
          }
          .input-area {
            flex-direction: column;
            gap: 10px;
          }
          .input-area button {
            width: 100%;
            padding: 12px;
          }
          .creative-generator-container .controls {
            flex-direction: column;
            align-items: stretch;
          }
          .creative-generator-container select,
          .creative-generator-container button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoriesInTheSky />
  </React.StrictMode>,
);
