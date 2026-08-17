import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState('');
  const [sideFrames, setSideFrames] = useState([]);
  const [frontFrames, setFrontFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // 1. Fetch all available review clips
  useEffect(() => {
    fetchClips();
  }, []);

  const fetchClips = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/clips`);
      setClips(res.data.clips);
      if (res.data.clips.length > 0) {
        setSelectedClip(res.data.clips[0]);
      }
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    }
  };

  // 2. Fetch frames when clip selection changes
  useEffect(() => {
    if (!selectedClip) return;

    const fetchFrames = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/review/${selectedClip}/frames`);
        setSideFrames(res.data.side_frames || []);
        setFrontFrames(res.data.front_frames || []);
        setCurrentIndex(0);
      } catch (err) {
        console.error('Failed to fetch frames:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFrames();
  }, [selectedClip]);

  const currentSideFrame = sideFrames[currentIndex];
  const currentFrontFrame = frontFrames[currentIndex] || frontFrames[0];

  return (
    <div className="dashboard-container">
      {/* Top Navigation Bar */}
      <header className="header">
        <div>
          <h2>🏏 3rd Umpire Decision Review System (DRS)</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Indoor Cricket Wide Decision Module</p>
        </div>
        <div>
          <label style={{ marginRight: '8px', fontSize: '14px' }}>Select Clip:</label>
          <select 
            className="clip-selector" 
            value={selectedClip} 
            onChange={(e) => setSelectedClip(e.target.value)}
          >
            {clips.map((clip) => (
              <option key={clip} value={clip}>{clip}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Split-Screen Dual Camera View */}
      <main className="dual-grid">
        {/* Side View (Crease) */}
        <div className="video-card">
          <div className="video-header">
            <span>SIDE VIEW (Batting Crease)</span>
            <span className="badge badge-side">Leg Umpire</span>
          </div>
          <div className="frame-viewport">
            {currentSideFrame ? (
              <img 
                src={`${API_BASE_URL}${currentSideFrame.url}`} 
                alt="Side Frame" 
              />
            ) : (
              <p>{loading ? 'Loading Frames...' : 'No Side Frames Available'}</p>
            )}
          </div>
        </div>

        {/* Front View (Pitch) */}
        <div className="video-card">
          <div className="video-header">
            <span>FRONT VIEW (Wide Lines)</span>
            <span className="badge badge-front">Main Umpire</span>
          </div>
          <div className="frame-viewport">
            {currentFrontFrame ? (
              <img 
                src={`${API_BASE_URL}${currentFrontFrame.url}`} 
                alt="Front Frame" 
              />
            ) : (
              <p>{loading ? 'Loading Frames...' : 'No Front Frames Available'}</p>
            )}
          </div>
        </div>
      </main>

      {/* Info Status Bar */}
      <footer className="footer-info">
        <span>Frame: {sideFrames.length > 0 ? `${currentIndex + 1} / ${sideFrames.length}` : '0 / 0'}</span>
        <span>Timestamp: {currentSideFrame ? `${currentSideFrame.timestamp} ms` : 'N/A'}</span>
        <span>System Status: <strong style={{ color: '#10b981' }}>Connected to Backend</strong></span>
      </footer>
    </div>
  );
}

export default App;