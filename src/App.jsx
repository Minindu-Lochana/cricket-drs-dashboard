import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Sliders, CheckCircle2, XCircle } from 'lucide-react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState('');
  const [sideFrames, setSideFrames] = useState([]);
  const [frontFrames, setFrontFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Digital Overlay State
  const [showOverlay, setShowOverlay] = useState(true);
  const [offsideX, setOffsideX] = useState(30);
  const [legsideX, setLegsideX] = useState(70);

  // 3rd Umpire Verdict State
  const [verdict, setVerdict] = useState(null); // 'WIDE' | 'NOT_WIDE' | null

  const playIntervalRef = useRef(null);
  const canvasRef = useRef(null);

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

  useEffect(() => {
    if (!selectedClip) return;

    const fetchFrames = async () => {
      setLoading(true);
      setIsPlaying(false);
      setVerdict(null);
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

  // Playback Interval
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          if (prevIndex >= sideFrames.length - 1) {
            setIsPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, 50);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, sideFrames.length]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'ArrowRight') {
        stepForward();
      } else if (e.code === 'ArrowLeft') {
        stepBackward();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sideFrames.length]);

  // Draw Canvas Lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!showOverlay) return;

    // Offside Line
    const offX = (offsideX / 100) * width;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(offX, 0);
    ctx.lineTo(offX, height);
    ctx.stroke();

    ctx.fillStyle = '#00e5ff';
    ctx.font = '12px Segoe UI';
    ctx.fillText('OFF WIDE', offX + 5, 20);

    // Legside Line
    const legX = (legsideX / 100) * width;
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legX, 0);
    ctx.lineTo(legX, height);
    ctx.stroke();

    ctx.fillStyle = '#ff1744';
    ctx.fillText('LEG WIDE', legX + 5, 20);

  }, [showOverlay, offsideX, legsideX]);

  const stepForward = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(prev + 1, sideFrames.length - 1));
  };

  const stepBackward = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetFrames = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const currentSideFrame = sideFrames[currentIndex];
  
  let matchedFrontFrame = null;
  let timeDifferenceMs = 0;

  if (currentSideFrame && frontFrames.length > 0) {
    matchedFrontFrame = frontFrames.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.timestamp - currentSideFrame.timestamp);
      const currDiff = Math.abs(curr.timestamp - currentSideFrame.timestamp);
      return currDiff < prevDiff ? curr : prev;
    });
    timeDifferenceMs = Math.abs(matchedFrontFrame.timestamp - currentSideFrame.timestamp);
  }

  // Handle Verdict Submission
  const handleDecision = async (decisionType) => {
    setVerdict(decisionType);

    try {
      await axios.post(`${API_BASE_URL}/record-decision`, {
        clip_id: selectedClip,
        verdict: decisionType,
        side_timestamp: currentSideFrame ? currentSideFrame.timestamp : 0,
        front_timestamp: matchedFrontFrame ? matchedFrontFrame.timestamp : 0
      });
    } catch (err) {
      console.error('Failed to record decision:', err);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <header className="header">
        <div>
          <h2>🏏 3rd Umpire Decision Review System (DRS)</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Virtual Wide Line Overlay & Broadcast Verdict Engine</p>
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

      {/* Dual Video View */}
      <main className="dual-grid" style={{ position: 'relative' }}>
        {/* Side View */}
        <div className="video-card">
          <div className="video-header">
            <span>SIDE VIEW (Batting Crease)</span>
            <span className="badge badge-side">Leg Umpire</span>
          </div>
          <div className="frame-viewport">
            {currentSideFrame ? (
              <img src={`${API_BASE_URL}${currentSideFrame.url}`} alt="Side Frame" />
            ) : (
              <p>{loading ? 'Loading...' : 'No Side Frames'}</p>
            )}
          </div>
        </div>

        {/* Front View with Digital Canvas Overlay */}
        <div className="video-card">
          <div className="video-header">
            <span>FRONT VIEW (Wide Lines)</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {matchedFrontFrame && (
                <span className={`sync-badge ${timeDifferenceMs <= 20 ? 'sync-excellent' : 'sync-acceptable'}`}>
                  Sync Offset: {timeDifferenceMs}ms
                </span>
              )}
              <span className="badge badge-front">Main Umpire</span>
            </div>
          </div>
          <div className="frame-viewport">
            {matchedFrontFrame ? (
              <>
                <img src={`${API_BASE_URL}${matchedFrontFrame.url}`} alt="Front Frame" />
                <canvas 
                  ref={canvasRef} 
                  width={640} 
                  height={360} 
                  className="canvas-overlay"
                />
              </>
            ) : (
              <p>{loading ? 'Loading...' : 'No Front Frames'}</p>
            )}
          </div>
        </div>

        {/* Broadcast Verdict Banner */}
        {verdict && (
          <div className={`broadcast-verdict-overlay ${verdict === 'WIDE' ? 'verdict-wide-style' : 'verdict-notwide-style'}`}>
            {verdict === 'WIDE' ? '🔴 DECISION: WIDE GIVEN' : '🟢 DECISION: WIDE NOT GIVEN'}
          </div>
        )}
      </main>

      {/* Decision Action Panel */}
      <section className="decision-panel">
        <strong style={{ fontSize: '14px' }}>3rd Umpire Decision:</strong>
        <div className="verdict-btn-group">
          <button 
            className="btn-verdict btn-wide" 
            onClick={() => handleDecision('WIDE')}
          >
            <XCircle size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            WIDE
          </button>
          <button 
            className="btn-verdict btn-not-wide" 
            onClick={() => handleDecision('NOT_WIDE')}
          >
            <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            NOT WIDE (LEGAL)
          </button>
        </div>
      </section>

      {/* Calibration Panel */}
      <section className="calibration-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="#0ea5e9" />
          <strong style={{ fontSize: '14px' }}>Wide Line Calibration:</strong>
        </div>
        
        <div className="line-slider-group">
          <label style={{ color: '#00e5ff' }}>Offside Line:</label>
          <input 
            type="range" 
            min="5" 
            max="45" 
            value={offsideX} 
            onChange={(e) => setOffsideX(Number(e.target.value))} 
          />
          <span>{offsideX}%</span>
        </div>

        <div className="line-slider-group">
          <label style={{ color: '#ff1744' }}>Legside Line:</label>
          <input 
            type="range" 
            min="55" 
            max="95" 
            value={legsideX} 
            onChange={(e) => setLegsideX(Number(e.target.value))} 
          />
          <span>{legsideX}%</span>
        </div>

        <button 
          className={`toggle-btn ${showOverlay ? '' : 'off'}`}
          onClick={() => setShowOverlay(!showOverlay)}
        >
          {showOverlay ? 'Hide DRS Lines' : 'Show DRS Lines'}
        </button>
      </section>

      {/* Controls Card */}
      <section className="controls-card">
        <div className="timeline-container">
          <span style={{ fontSize: '13px', color: '#94a3b8', minWidth: '40px' }}>
            {currentIndex + 1}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(sideFrames.length - 1, 0)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            className="timeline-slider"
          />
          <span style={{ fontSize: '13px', color: '#94a3b8', minWidth: '40px' }}>
            {sideFrames.length}
          </span>
        </div>

        <div className="button-group">
          <button className="btn-ctrl" onClick={resetFrames} title="Reset">
            <RotateCcw size={16} /> Reset
          </button>
          <button className="btn-ctrl" onClick={stepBackward} title="Previous Frame">
            <ChevronLeft size={18} /> Prev Frame
          </button>
          <button 
            className="btn-ctrl btn-primary" 
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="btn-ctrl" onClick={stepForward} title="Next Frame">
            Next Frame <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer Info */}
      <footer className="footer-info">
        <span>Frame: {sideFrames.length > 0 ? `${currentIndex + 1} / ${sideFrames.length}` : '0 / 0'}</span>
        <span>Side TS: {currentSideFrame ? `${currentSideFrame.timestamp} ms` : 'N/A'}</span>
        <span>Front TS: {matchedFrontFrame ? `${matchedFrontFrame.timestamp} ms` : 'N/A'}</span>
        <span>Verdict: <strong style={{ color: verdict === 'WIDE' ? '#ef4444' : (verdict === 'NOT_WIDE' ? '#10b981' : '#94a3b8') }}>{verdict || 'PENDING'}</strong></span>
      </footer>
    </div>
  );
}

export default App;