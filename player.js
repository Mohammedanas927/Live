document.addEventListener('DOMContentLoaded', () => {
  let channels = [];
  let currentChannel = null;
  let hlsInstance = null;
  let controlsTimeout = null;

  // DOM Elements
  const videoElement = document.getElementById('live-video');
  const videoWrapper = document.getElementById('video-wrapper');
  const errorScreen = document.getElementById('video-error-screen');
  const errorTitleText = document.getElementById('error-title-text');
  const errorMsgText = document.getElementById('error-msg-text');
  const retryBtn = document.getElementById('btn-retry-stream');

  // Channel details
  const channelName = document.getElementById('channel-name');
  const badgeCategory = document.getElementById('badge-category');
  const badgeLanguage = document.getElementById('badge-language');
  const badgeRating = document.getElementById('badge-rating');
  const channelLogoImg = document.getElementById('channel-logo-img');
  const channelDescription = document.getElementById('channel-description');
  const sidebarRecommendations = document.getElementById('sidebar-recommendations');

  // Custom Controls Elements
  const controlsOverlay = document.getElementById('custom-controls-overlay');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnCenterPlay = document.getElementById('btn-center-play');
  const loadingSpinner = document.getElementById('video-loading-spinner');
  const btnMute = document.getElementById('btn-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const btnFullscreenToggle = document.getElementById('btn-fullscreen-toggle');
  const settingsMenuPanel = document.getElementById('settings-menu-panel');
  const qualitySelectorList = document.getElementById('quality-selector-list');
  const speedSelectorList = document.getElementById('speed-selector-list');

  // Load database
  fetch('channels.json?v=1.1')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load channels database');
      }
      return response.json();
    })
    .then(data => {
      channels = data;
      loadPageContent();
    })
    .catch(error => {
      console.error('Error loading channels:', error);
      showPlaybackError('Database Error', 'Unable to retrieve channels metadata. Please check the console or try again.');
    });

  // Main page loader
  function loadPageContent() {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    
    currentChannel = channels.find(c => c.id === channelId);
    
    if (!currentChannel) {
      if (channels.length > 0) {
        currentChannel = channels[0];
        history.replaceState(null, '', `player.html?channel=${currentChannel.id}`);
      } else {
        showPlaybackError('No Channels Available', 'There are no streaming channels configured.');
        return;
      }
    }

    // Update browser window title
    document.title = `Watch ${currentChannel.name} Live - Tamil Box Live`;

    // Populate Details Card
    channelName.textContent = currentChannel.name;
    badgeCategory.textContent = currentChannel.category;
    badgeLanguage.textContent = currentChannel.language;
    badgeRating.textContent = currentChannel.rating || 'U/A 13+';
    channelDescription.textContent = currentChannel.description;
    
    // Set channel logo image
    if (currentChannel.image) {
      channelLogoImg.src = currentChannel.image;
      channelLogoImg.alt = `${currentChannel.name} Logo`;
      channelLogoImg.style.display = 'block';
    } else {
      channelLogoImg.style.display = 'none';
    }

    // Start video playback
    initVideoPlayer(currentChannel.url);

    // Populate Sidebar items
    renderSidebar();
  }

  // Initialize HLS / Native video streaming
  function initVideoPlayer(streamUrl) {
    hidePlaybackError();
    cleanupPlayer();
    resetControlUI();

    if (!streamUrl) {
      showPlaybackError('Missing Stream URL', 'The selected channel does not have a valid streaming source configured.');
      return;
    }

    showLoadingSpinner(true);

    // Hls.js support check (Chrome, Firefox, Edge, Safari macOS, etc.)
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true
      });
      
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(videoElement);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        showLoadingSpinner(false);
        setupQualitySelector();
        videoElement.play().catch(e => {
          console.warn('Auto-play blocked or failed:', e);
          updatePlayPauseUI(false);
        });
      });

      // Show/Hide Spinner on Buffer stalls
      hlsInstance.on(Hls.Events.FRAG_LOADING, () => showLoadingSpinner(true));
      hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => showLoadingSpinner(false));

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        showLoadingSpinner(false);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, trying to recover...', data);
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, trying to recover...', data);
              hlsInstance.recoverMediaError();
              break;
            default:
              console.error('Fatal player error. Cannot recover.', data);
              showPlaybackError(
                'Playback Stream Error',
                'This channel stream appears to be offline or blocked. You can try reloading or check other channels.'
              );
              cleanupPlayer();
              break;
          }
        }
      });
    } 
    // Native HLS support check (e.g. Safari / iOS)
    else if (videoElement.canPlayType('application/x-mpegURL') || videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = streamUrl;
      setupQualitySelectorNative();
      
      videoElement.addEventListener('loadedmetadata', () => {
        showLoadingSpinner(false);
        videoElement.play().catch(e => {
          console.warn('Auto-play blocked or failed:', e);
          updatePlayPauseUI(false);
        });
      });

      // Spinner events
      videoElement.addEventListener('waiting', () => showLoadingSpinner(true));
      videoElement.addEventListener('playing', () => showLoadingSpinner(false));
      videoElement.addEventListener('error', handleNativeError);
    } 
    else {
      showLoadingSpinner(false);
      showPlaybackError(
        'Unsupported Browser',
        'Your web browser does not support HLS (.m3u8) video streaming. Please use Chrome, Edge, Safari or Firefox.'
      );
    }
  }

  function handleNativeError(e) {
    showLoadingSpinner(false);
    console.error('Native HTML5 video error:', e);
    showPlaybackError(
      'Stream Offline',
      'The live streaming connection was lost or timed out. Please try reloading this stream.'
    );
  }

  // Clear video source and Hls.js instance
  function cleanupPlayer() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    videoElement.removeAttribute('src');
    videoElement.load();
    
    // Remove native event listeners
    videoElement.removeEventListener('error', handleNativeError);
    showLoadingSpinner(false);
  }

  // ==========================================
  // CUSTOM PLAYER CONTROLS IMPLEMENTATION
  // ==========================================

  // Play/Pause actions
  function togglePlayPause() {
    if (videoElement.paused || videoElement.ended) {
      videoElement.play().then(() => {
        updatePlayPauseUI(true);
      }).catch(err => {
        console.error('Play request failed:', err);
      });
    } else {
      videoElement.pause();
      updatePlayPauseUI(false);
    }
  }

  function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
      btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
      btnCenterPlay.style.display = 'none';
    } else {
      btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
      btnCenterPlay.style.display = 'flex';
    }
  }

  function resetControlUI() {
    updatePlayPauseUI(false);
    videoElement.playbackRate = 1.0;
    document.querySelectorAll('#speed-selector-list .settings-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-speed') === '1') {
        item.classList.add('active');
      }
    });
  }

  // Volume actions
  function toggleMute() {
    videoElement.muted = !videoElement.muted;
    updateVolumeUI();
  }

  function updateVolumeUI() {
    const isMuted = videoElement.muted || videoElement.volume === 0;
    volumeSlider.value = videoElement.muted ? 0 : videoElement.volume;

    if (isMuted) {
      btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (videoElement.volume < 0.5) {
      btnMute.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
      btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }

  // Quality Selectors Populating
  function setupQualitySelector() {
    if (!hlsInstance) return;

    const levels = hlsInstance.levels;
    let qualityItemsHTML = `<li class="settings-item active" data-level="-1">Auto</li>`;

    levels.forEach((level, idx) => {
      const label = level.height ? `${level.height}p` : `Level ${idx + 1}`;
      qualityItemsHTML += `<li class="settings-item" data-level="${idx}">${label}</li>`;
    });

    qualitySelectorList.innerHTML = qualityItemsHTML;

    // Attach click events
    document.querySelectorAll('#quality-selector-list .settings-item').forEach(item => {
      item.addEventListener('click', () => {
        const levelIndex = parseInt(item.getAttribute('data-level'), 10);
        hlsInstance.currentLevel = levelIndex;

        // Update active class
        document.querySelectorAll('#quality-selector-list .settings-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // Toggle dropdown off
        settingsMenuPanel.style.display = 'none';
      });
    });
  }

  function setupQualitySelectorNative() {
    // Quality selection is system managed in Native iOS Safari HLS, so we show an informative indicator
    qualitySelectorList.innerHTML = `<li class="settings-item active" data-level="-1">Auto (System Managed)</li>`;
  }

  // Loading spinner trigger
  function showLoadingSpinner(show) {
    if (show) {
      loadingSpinner.style.display = 'block';
      btnCenterPlay.style.display = 'none';
    } else {
      loadingSpinner.style.display = 'none';
      if (videoElement.paused) {
        btnCenterPlay.style.display = 'flex';
      }
    }
  }

  // Fullscreen actions
  function toggleFullscreen() {
    if (!document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      // Enter Fullscreen on videoWrapper (so controls render on top)
      if (videoWrapper.requestFullscreen) {
        videoWrapper.requestFullscreen();
      } else if (videoWrapper.webkitRequestFullscreen) {
        videoWrapper.webkitRequestFullscreen();
      } else if (videoWrapper.mozRequestFullScreen) {
        videoWrapper.mozRequestFullScreen();
      } else if (videoWrapper.msRequestFullscreen) {
        videoWrapper.msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  function updateFullscreenUI() {
    const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement || 
                          document.msFullscreenElement;

    if (isFullscreen) {
      btnFullscreenToggle.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
      btnFullscreenToggle.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
  }

  // Hide Controls on Inactivity
  function resetControlsTimeout() {
    controlsOverlay.classList.add('show-controls');
    clearTimeout(controlsTimeout);

    // Only auto-hide controls if video is actively playing, settings panel is closed, and volume slider isn't hovered
    if (!videoElement.paused && settingsMenuPanel.style.display === 'none') {
      controlsTimeout = setTimeout(() => {
        controlsOverlay.classList.remove('show-controls');
      }, 3000);
    }
  }

  // Attach controls listeners
  btnPlayPause.addEventListener('click', togglePlayPause);
  btnCenterPlay.addEventListener('click', togglePlayPause);
  videoElement.addEventListener('click', togglePlayPause);
  
  // Update UI on video state events
  videoElement.addEventListener('play', () => updatePlayPauseUI(true));
  videoElement.addEventListener('pause', () => updatePlayPauseUI(false));
  videoElement.addEventListener('volumechange', updateVolumeUI);

  // Mute toggle
  btnMute.addEventListener('click', toggleMute);

  // Volume slider input
  volumeSlider.addEventListener('input', (e) => {
    videoElement.volume = parseFloat(e.target.value);
    videoElement.muted = (videoElement.volume === 0);
    updateVolumeUI();
  });

  // Settings Panel Toggle
  btnSettingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = settingsMenuPanel.style.display === 'block';
    settingsMenuPanel.style.display = isVisible ? 'none' : 'block';
  });

  // Close Settings panel if clicked elsewhere
  document.addEventListener('click', (e) => {
    if (!settingsMenuPanel.contains(e.target) && e.target !== btnSettingsToggle) {
      settingsMenuPanel.style.display = 'none';
    }
  });

  // Playback speed rate selector trigger
  document.querySelectorAll('#speed-selector-list .settings-item').forEach(item => {
    item.addEventListener('click', () => {
      const speed = parseFloat(item.getAttribute('data-speed'));
      videoElement.playbackRate = speed;

      // Update active classes
      document.querySelectorAll('#speed-selector-list .settings-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      // Close popover
      settingsMenuPanel.style.display = 'none';
    });
  });

  // Fullscreen trigger & listener Sync
  btnFullscreenToggle.addEventListener('click', toggleFullscreen);
  
  const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
  fullscreenEvents.forEach(evt => {
    document.addEventListener(evt, updateFullscreenUI);
  });

  // Inactivity fade out
  videoWrapper.addEventListener('mousemove', resetControlsTimeout);
  videoWrapper.addEventListener('mouseleave', () => {
    if (!videoElement.paused) {
      controlsOverlay.classList.remove('show-controls');
    }
  });

  // ==========================================
  // SIDEBAR RECOMMENDATIONS AND ROUTING
  // ==========================================

  // Populate Recommendations Sidebar list
  function renderSidebar() {
    // Filter out current channel and render others
    const otherChannels = channels.filter(channel => channel.id !== currentChannel.id);

    // Sort: Same category first
    otherChannels.sort((a, b) => {
      if (a.category === currentChannel.category && b.category !== currentChannel.category) return -1;
      if (a.category !== currentChannel.category && b.category === currentChannel.category) return 1;
      return 0;
    });

    sidebarRecommendations.innerHTML = otherChannels.map(channel => `
      <div class="mini-channel-card" data-id="${channel.id}">
        <img class="mini-logo-container" src="${channel.image}" alt="${channel.name} Logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'><rect width=\'100\' height=\'100\' fill=\'%230c192c\'/><text x=\'50%\' y=\'50%\' font-family=\'Outfit\' font-size=\'14\' fill=\'%238f98a9\' dominant-baseline=\'middle\' text-anchor=\'middle\'>${channel.name.substring(0,2)}</text></svg>'">
        <div class="mini-info">
          <h3 class="mini-title">${channel.name}</h3>
          <span class="mini-category">${channel.category}</span>
        </div>
      </div>
    `).join('');

    // Attach click events to mini cards
    const miniCards = document.querySelectorAll('.mini-channel-card');
    miniCards.forEach(card => {
      card.addEventListener('click', () => {
        const selectedId = card.getAttribute('data-id');

        // Smoothly change url without a hard reload
        history.pushState(null, '', `player.html?channel=${selectedId}`);
        loadPageContent();
      });
    });
  }

  // ==========================================
  // ERROR SCREEN & RETRY PLAYBACK CONTROLLER
  // ==========================================

  function showPlaybackError(title, message) {
    errorTitleText.textContent = title;
    errorMsgText.textContent = message;
    errorScreen.style.display = 'flex';
  }

  function hidePlaybackError() {
    errorScreen.style.display = 'none';
  }

  // Handle retry click
  retryBtn.addEventListener('click', () => {
    if (currentChannel) {
      initVideoPlayer(currentChannel.url);
    }
  });

  // Handle browser navigation back/forward events
  window.addEventListener('popstate', () => {
    loadPageContent();
  });
});
