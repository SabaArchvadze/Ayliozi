import { useState } from 'react';
import { socket } from '../socket';
import { VscReport } from "react-icons/vsc";
import { BackgroundCards } from './BackgroundCards'; // Import our new component

export function Home({ error, setError }) {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportStatus, setReportStatus] = useState('');

  const validateAndProceed = (action) => {
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    setError('');
    if (action === 'create') {
      socket.emit('createGame', { username });
    } else if (action === 'join') {
      socket.emit('joinGame', { username, roomCode });
    }
  };

  const handleUsernameChange = (e) => {
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9\u10A0-\u10FF]/g, '');
    setUsername(sanitized);
  };

  const handleSubmitReport = async () => {
    if (reportContent.trim().length < 10) {
      setReportStatus('Report must be at least 10 characters long.');
      return;
    }
    setReportStatus('Sending...');

    try {
      const response = await fetch('http://localhost:3001/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportContent }),
      });

      const result = await response.json();
      if (response.ok) {
        setReportStatus('Thank you! Your report has been sent.');
        setTimeout(() => {
          setShowReportModal(false);
          setReportContent('');
          setReportStatus('');
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to send report.');
      }
    } catch (err) {
      setReportStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="home-screen">
      <BackgroundCards cardCount={15} /> {/* It's now just one line! */}

      <img src="/ayliozi.webp" alt="Game Title" className="title-image" />

      <div className="home-container">
        <input
          type="text"
          placeholder="შენი სახელი"
          value={username}
          onChange={handleUsernameChange}
          maxLength="12"
        />
        <div className="home-actions">
          <div className="home-box">
            <h4>შეუერთდი ოთახს</h4>
            <input
              type="text"
              placeholder="ოთახის კოდი"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button onClick={() => validateAndProceed('join')}>შეუერთდი</button>
          </div>
          <div className="home-box">
            <h4>შექმენი ახალი ოთახი</h4>
            <p>შექმენი ახალი ოთახი და მოიწვიე მეგობრები</p>
            <button onClick={() => validateAndProceed('create')}>შექმენი</button>
          </div>
        </div>
      </div>
      <p className="error-message">{error}</p>

      <button className="report-button" onClick={() => setShowReportModal(true)} title="Report a Bug">
        <VscReport />
      </button>

      {showReportModal && (
        <div className="confirmation-overlay">
          <div className="confirmation-box report-modal">
            <h3>Report a Bug or Give Feedback</h3>
            <p>Found an issue? Let us know! If you have a screenshot, please upload it to a site like Imgur and paste the link in your report.</p>
            <textarea
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              placeholder="Please describe the bug or feedback in detail..."
              rows="6"
            ></textarea>
            <div className="confirmation-buttons">
              <button onClick={() => setShowReportModal(false)}>Cancel</button>
              <button onClick={handleSubmitReport}>Submit Report</button>
            </div>
            {reportStatus && <p className="report-status">{reportStatus}</p>}
          </div>
        </div>
      )}
    </div>
  );
}