document.addEventListener('DOMContentLoaded', () => {
  let channels = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let activeSlideIndex = 0;
  let slideInterval = null;

  // DOM Elements
  const heroSlider = document.getElementById('hero-slider');
  const channelsGrid = document.getElementById('channels-grid');
  const categoryTabs = document.querySelectorAll('.category-tab');
  const searchInput = document.getElementById('search-input');
  const sectionTitleText = document.getElementById('section-title-text');

  // Load channels data
  fetch('channels.json?v=1.1')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load channels database');
      }
      return response.json();
    })
    .then(data => {
      channels = data;
      initApp();
    })
    .catch(error => {
      console.error('Error loading channels:', error);
      channelsGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="no-results-title">Failed to load channels</div>
          <div class="no-results-desc">Unable to retrieve TV database. Please refresh the page or check your connection.</div>
        </div>
      `;
    });

  function initApp() {
    renderHeroSlider();
    renderChannels();
    setupCategories();
    setupSearch();
  }

  // Render the featured hero slider/carousel
  function renderHeroSlider() {
    const featuredChannels = channels.filter(c => c.featured);
    if (featuredChannels.length === 0) {
      heroSlider.style.display = 'none';
      return;
    }

    heroSlider.innerHTML = featuredChannels.map((channel, idx) => `
      <div class="hero-slide ${idx === 0 ? 'active' : ''}" style="background-image: url('assets/hero_banner.png')" data-index="${idx}">
        <div class="hero-overlay"></div>
        <div class="hero-details">
          <span class="hero-tag">Featured Live Channel</span>
          <h1 class="hero-title">${channel.name}</h1>
          <div class="hero-meta">
            <span class="meta-item"><i class="fa-solid fa-language"></i> ${channel.language}</span>
            <span class="meta-item"><i class="fa-solid fa-tag"></i> ${channel.category}</span>
            <span class="meta-item rating">${channel.rating || 'U'}</span>
          </div>
          <p class="hero-desc">${channel.description}</p>
          <div class="hero-actions">
            <button class="btn-primary" onclick="window.location.href='player.html?channel=${channel.id}'">
              <span class="btn-icon"><i class="fa-solid fa-play"></i></span> Watch Live
            </button>
          </div>
        </div>
        <div class="hero-poster-container">
          <img class="hero-poster-img" src="${channel.image}" alt="${channel.name} Logo">
        </div>
      </div>
    `).join('');

    // Start sliding carousel rotation if multiple featured channels exist
    if (featuredChannels.length > 1) {
      startHeroRotation(featuredChannels.length);
    }
  }

  function startHeroRotation(count) {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(() => {
      const slides = document.querySelectorAll('.hero-slide');
      if (slides.length === 0) return;
      
      slides[activeSlideIndex].classList.remove('active');
      activeSlideIndex = (activeSlideIndex + 1) % count;
      slides[activeSlideIndex].classList.add('active');
    }, 5000); // Rotate every 5 seconds
  }

  // Render the grid of channel cards
  function renderChannels() {
    // Filter logic
    const filteredChannels = channels.filter(channel => {
      const matchesCategory = currentCategory === 'all' || 
                              channel.category.toLowerCase() === currentCategory.toLowerCase();
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            channel.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            channel.language.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    if (filteredChannels.length === 0) {
      channelsGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon"><i class="fa-solid fa-circle-question"></i></div>
          <div class="no-results-title">No channels found</div>
          <div class="no-results-desc">We couldn't find any channels matching "${searchQuery}" in this category.</div>
        </div>
      `;
      return;
    }

    channelsGrid.innerHTML = filteredChannels.map(channel => `
      <div class="channel-card" onclick="window.location.href='player.html?channel=${channel.id}'">
        <div class="card-logo-container">
          <img class="channel-logo-img" src="${channel.image}" alt="${channel.name} Logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'><rect width=\'100\' height=\'100\' fill=\'%230c192c\'/><text x=\'50%\' y=\'50%\' font-family=\'Outfit\' font-size=\'18\' fill=\'%238f98a9\' dominant-baseline=\'middle\' text-anchor=\'middle\'>${channel.name.substring(0,2)}</text></svg>'">
          <div class="card-overlay">
            <div class="play-circle">
              <div class="play-triangle"></div>
            </div>
          </div>
        </div>
        <div class="card-info">
          <h3 class="card-title">${channel.name}</h3>
          <div class="card-tags">
            <span class="card-category">${channel.category}</span>
            <span class="card-lang">${channel.language}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Set up click actions for category tabs
  function setupCategories() {
    categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Toggle active tabs
        categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        currentCategory = tab.getAttribute('data-category');
        
        // Update Title text dynamically
        if (currentCategory === 'all') {
          sectionTitleText.textContent = 'All Channels';
        } else {
          sectionTitleText.textContent = `${tab.textContent} Channels`;
        }

        renderChannels();
      });
    });
  }

  // Set up keyup listening for search inputs
  function setupSearch() {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderChannels();
    });
  }
});
