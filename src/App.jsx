import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [videoId, setVideoId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);  // To manage loading screen
  const [healthCheckStatus, setHealthCheckStatus] = useState(false); // Health check status
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Health check function
  const healthCheck = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/`);
      if (response.ok) {
        setHealthCheckStatus(true);
      } else {
        setHealthCheckStatus(false);
      }
    } catch (error) {
      setHealthCheckStatus(false);
    }
  };

  // Retry health check every 5 seconds until successful
  useEffect(() => {
    const interval = setInterval(() => {
      if (!healthCheckStatus) {
        healthCheck();
      }
    }, 5000);

    // Call health check on initial load
    healthCheck();

    return () => clearInterval(interval); // Cleanup interval
  }, [healthCheckStatus]);

  // Set isLoading to false once health check is successful
  useEffect(() => {
    if (healthCheckStatus) {
      setIsLoading(false);
    }
  }, [healthCheckStatus]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setUploadStatus('');
      setSearchResults([]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a video file first.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Processing video... This may take a few minutes.');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-video/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setVideoId(result.video_id);
        setSummary(result.summary || '');
        setUploadStatus(`Video processed successfully! Found ${result.total_chunks} chunks.`);
      } else {
        const error = await response.json();
        setUploadStatus(`Upload failed: ${error.detail}`);
      }
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!videoId || !searchQuery.trim()) {
      alert('Please upload a video and enter a search query.');
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`${API_BASE_URL}/search/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          query: searchQuery,
          top_k: 5,
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        const error = await response.json();
        alert(`Search failed: ${error.detail}`);
      }
    } catch (error) {
      alert(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const jumpToTimestamp = (timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const loadVideos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/`);
      if (response.ok) {
        const videoList = await response.json();
        setVideos(videoList);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleDownloadSrt = async () => {
    if (!videoId) {
      alert('Video ID not found.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/download-srt/${videoId}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${videoId}.srt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(`Failed to download SRT: ${error.detail}`);
      }
    } catch (error) {
      alert(`Download failed: ${error.message}`);
    }
  };

  React.useEffect(() => {
    loadVideos();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Video Semantic Search</h1>
        <p>Upload a video, and search for specific content using natural language!</p>
      </header>

      <main className="main-content">
        {isLoading ? (
          <div className="loading-screen">
            <p>Loading...</p>
          </div>
        ) : (
          <>
            <section className="upload-section">
              <h2>Upload Video</h2>
              <div className="upload-container">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="file-input"
                />
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="upload-btn"
                >
                  {isUploading ? 'Processing...' : 'Upload & Process Video'}
                </button>
              </div>

              {uploadStatus && (
                <div className={`status-message ${uploadStatus.includes('failed') ? 'error' : 'success'}`}>
                  {uploadStatus}
                </div>
              )}

              {videoId && uploadStatus.includes('successfully') && (
                <button onClick={handleDownloadSrt} className="download-btn">
                  Download SRT Subtitle
                </button>
              )}
            </section>

            {videoUrl && (
              <section className="video-section">
                <h2>Video Player</h2>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="video-player"
                  width="100%"
                  height="400"
                >
                  Your browser does not support the video tag.
                </video>
              </section>
            )}

            {videoId && (
              <section className="search-section">
                <h2>Search Video Content</h2>
                <div className="search-container">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter your search query (e.g., 'introduction', 'main points', 'conclusion')"
                    className="search-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button onClick={handleSearch} disabled={isSearching} className="search-btn">
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </section>
            )}

            {searchResults.length > 0 && (
              <section className="results-section">
                <h2>Search Results</h2>
                <div className="results-container">
                  {searchResults.map((result, index) => (
                    <div key={index} className="result-item">
                      <div className="result-header">
                        <span className="timestamp-badge">
                          {formatTime(result.chunk.start_time)} - {formatTime(result.chunk.end_time)}
                        </span>
                        <span className="similarity-score">
                          Score: {(result.similarity_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="result-text">{result.chunk.text}</p>
                      <button onClick={() => jumpToTimestamp(result.chunk.start_time)} className="jump-btn">
                        Jump to {formatTime(result.chunk.start_time)}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {summary && (
              <section className="results-section">
                <h2>Transcript Summary</h2>
                <p className="result-text">{summary}</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
