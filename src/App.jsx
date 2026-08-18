import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState('');
  const [sideFrames, setSideFrames] = useState([]);
  const [frontFrames, setFrontFrames] = useState([]);
  
  // Navigation & Playback States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedFrontFrame, setMatchedFrontFrame] = useState(null);
  const [syncInfo, setSyncInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const playIntervalRef = useRef(null);

  // 1. Fetch available clips
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

  // 2. Fetch frames for selected clip
  useEffect(() => {
    if (!selectedClip) return;

    const fetchFrames = async () => {
      setLoading(true);
      setIsPlaying(false);
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

  // 3. Dynamic Frame Sync: Side frame වෙනස් වන විට Front frame match කිරීම
  useEffect(() => {
    if (sideFrames.length === 0) return;

    const currentSide = sideFrames[currentIndex];
    if (!currentSide) return;

    // Front frames තිබේ නම් Closest Timestamp එක සොයාගැනීම
    if (frontFrames.length > 0) {
      const targetTs = currentSide.timestamp;
      let closest = frontFrames[0];
      let minDiff = Math.abs(frontFrames[0].timestamp - targetTs);

      for (let i = 1; i < frontFrames.length; i++) {
        const diff = Math.abs(frontFrames[i].timestamp - targetTs);
        if (diff < minDiff) {
          minDiff = diff;
          closest = frontFrames[i];
        }
      }

      setMatchedFrontFrame(closest);
      setSyncInfo({
        offsetMs: minDiff,
        quality: minDiff <= 16 ? 'EXCELLENT' : (minDiff <= 35 ? 'GOOD' : 'ACCEPTABLE')
      });
    } else {
      setMatchedFrontFrame(null);
      setSyncInfo(null);
    }
  }, [currentIndex, sideFrames, frontFrames]);

  // 4. Auto-Play Logic
  useEffect(() => {
    if (isPlaying) {
      const intervalTime = (1000 / 30) / playbackSpeed; // Standard 30 FPS base scaled by speed
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= sideFrames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalTime);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, sideFrames.length]);

  // Controls Handlers
  const handleNextFrame = () => {
    setIsPlaying(false);
    if (currentIndex < sideFrames.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevFrame = () => {
    setIsPlaying(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const togglePlay = () => {
    if (currentIndex >= sideFrames.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const currentSideFrame = sideFrames[currentIndex];

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <header className="header">
        <div>
          <h2>🏏 3rd Umpire Decision Review System (DRS)</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Dual Camera Frame-by-Frame Analysis Module</p>
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

      {/* Dual Video Viewports */}
      <main className="dual-grid">
        {/* Side View */}
        <div className="video-card">
          <div className="video-header">
            <span>SIDE VIEW (Batting Crease Selection)</span>
            <span className="badge badge-side">Master Angle</span>
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

        {/* Front View */}
        <div className="video-card">
          <div className="video-header">
            <span>FRONT VIEW (Synchronized Wide Line View)</span>
            <span className="badge badge-front">Slave Angle</span>
          </div>
          <div className="frame-viewport">
            {matchedFrontFrame ? (
              <img 
                src={`${API_BASE_URL}${matchedFrontFrame.url}`} 
                alt="Front Frame" 
              />
            ) : (
              <p>{frontFrames.length === 0 ? 'No Front Frames Uploaded' : 'Matching Frame...'}</p>
            )}
          </div>
        </div>
      </main>

      {/* Scrubbing & Playback Controls */}
      <section className="controls-card">
        <div className="timeline-container">
          <span style={{ fontSize: '13px', minWidth: '45px' }}>{currentIndex + 1}</span>
          <input 
            type="range" 
            min="0" 
            max={Math.max(0, sideFrames.length - 1)} 
            value={currentIndex} 
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            className="scrubber-slider"
            disabled={sideFrames.length === 0}
          />
          <span style={{ fontSize: '13px', minWidth: '45px', textAlign: 'right' }}>{sideFrames.length}</span>
        </div>

        <div className="control-buttons-row">
          <div className="playback-controls">
            <button className="btn-ctrl" onClick={handlePrevFrame} disabled={currentIndex === 0 || sideFrames.length === 0}>
              ⏮ Step -1 Frame
            </button>
            <button className="btn-ctrl btn-play" onClick={togglePlay} disabled={sideFrames.length === 0}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button className="btn-ctrl" onClick={handleNextFrame} disabled={currentIndex >= sideFrames.length - 1 || sideFrames.length === 0}>
              Step +1 Frame ⏭
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {syncInfo && (
              <div className={`sync-badge sync-${syncInfo.quality.toLowerCase()}`}>
                Sync: ±{syncInfo.offsetMs}ms ({syncInfo.quality})
              </div>
            )}

            <div>
              <label style={{ marginRight: '8px', fontSize: '13px' }}>Speed:</label>
              <select 
                className="speed-select"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              >
                <option value={0.25}>0.25x (Slow-Mo)</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x (Normal)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <footer className="footer-info">
        <span>Active Side Timestamp: <strong>{currentSideFrame ? `${currentSideFrame.timestamp} ms` : 'N/A'}</strong></span>
        <span>Active Front Timestamp: <strong>{matchedFrontFrame ? `${matchedFrontFrame.timestamp} ms` : 'N/A'}</strong></span>
        <span>System: <strong style={{ color: '#10b981' }}>Live Frame Engine Active</strong></span>
      </footer>
    </div>
  );
}

export default App;