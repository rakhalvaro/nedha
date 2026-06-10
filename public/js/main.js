document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');
  const partnersGrid = document.getElementById('partnersGrid');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const statDownloads = document.getElementById('statDownloads');
  const statPartners = document.getElementById('statPartners');
  const mainDownloadBtn = document.getElementById('mainDownloadBtn');
  const heroDownloadBtn = document.getElementById('heroDownloadBtn');
  
  // Modal Elements
  const partnerModal = document.getElementById('partnerModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPartnerLogo = document.getElementById('modalPartnerLogo');
  const modalPartnerName = document.getElementById('modalPartnerName');
  const modalPartnerCategory = document.getElementById('modalPartnerCategory');
  const modalPartnerAddress = document.getElementById('modalPartnerAddress');
  const modalMenuGrid = document.getElementById('modalMenuGrid');

  // State variables
  let allPartners = [];

  // --- Mobile Navigation Toggle ---
  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
      navMenu.classList.toggle('show');
      const icon = hamburgerBtn.querySelector('i');
      if (navMenu.classList.contains('show')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });
  }

  // --- API Integrations & Analytics ---
  
  // Track page view
  fetch('/api/v1/analytics/view', { method: 'POST' })
    .catch(err => console.error('Failed to log page view:', err));

  // Fetch and display statistics (downloads & partners)
  function loadStats() {
    fetch('/api/v1/analytics')
      .then(res => res.json())
      .then(data => {
        if (statDownloads) statDownloads.textContent = data.downloads || 0;
        if (statPartners) statPartners.textContent = data.partnersCount || 0;
      })
      .catch(err => console.error('Failed to load stats:', err));
  }
  loadStats();

  // Track APK download clicks
  const registerDownloadClick = () => {
    fetch('/api/v1/analytics/download', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (statDownloads) statDownloads.textContent = data.downloads;
      })
      .catch(err => console.error('Error logging download click:', err));
  };

  if (mainDownloadBtn) mainDownloadBtn.addEventListener('click', registerDownloadClick);
  if (heroDownloadBtn) heroDownloadBtn.addEventListener('click', registerDownloadClick);

  // --- Fetch & Render Partners ---
  function fetchPartners() {
    fetch('/api/v1/partners')
      .then(res => res.json())
      .then(partners => {
        allPartners = partners;
        renderPartners(partners);
        if (statPartners) statPartners.textContent = partners.length;
      })
      .catch(err => {
        console.error('Failed to fetch partners:', err);
        partnersGrid.innerHTML = `
          <div class="error-state">
            <i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat daftar mitra. Silakan coba beberapa saat lagi.
          </div>
        `;
      });
  }
  fetchPartners();

  function renderPartners(partners) {
    if (partners.length === 0) {
      partnersGrid.innerHTML = `
        <div class="error-state">
          <i class="fa-solid fa-circle-info"></i> Belum ada mitra sehat yang terdaftar untuk kategori ini.
        </div>
      `;
      return;
    }

    partnersGrid.innerHTML = partners.map(partner => `
      <div class="partner-card" data-category="${partner.category.toLowerCase()}">
        <div class="partner-img-wrapper">
          <img src="${partner.logo}" alt="${partner.name}" class="partner-img">
          <span class="partner-badge-cat">${partner.category}</span>
          <span class="partner-rating"><i class="fa-solid fa-star"></i> ${partner.rating}</span>
        </div>
        <div class="partner-info">
          <h3 class="partner-name">${partner.name}</h3>
          <p class="partner-desc">${partner.description}</p>
          <span class="partner-address"><i class="fa-solid fa-location-dot"></i> ${partner.address || 'Yogyakarta'}</span>
        </div>
        <div class="partner-action">
          <button class="partner-btn" onclick="openPartnerMenu('${partner.id}')">
            <i class="fa-solid fa-utensils"></i> Lihat Menu Sehat
          </button>
        </div>
      </div>
    `).join('');
  }

  // --- Category Filters ---
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active classes
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.getAttribute('data-category');
      if (category === 'all') {
        renderPartners(allPartners);
      } else {
        const filtered = allPartners.filter(partner => 
          partner.category.toLowerCase().includes(category) ||
          partner.description.toLowerCase().includes(category)
        );
        renderPartners(filtered);
      }
    });
  });

  // --- Modal (Menu Details) Logic ---
  window.openPartnerMenu = function(partnerId) {
    const partner = allPartners.find(p => p.id === partnerId);
    if (!partner) return;

    // Set modal text
    modalPartnerLogo.src = partner.logo;
    modalPartnerLogo.alt = partner.name;
    modalPartnerName.textContent = partner.name;
    modalPartnerCategory.textContent = partner.category;
    modalPartnerAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${partner.address || 'Yogyakarta'}`;

    // Render Menu Items
    if (!partner.menu || partner.menu.length === 0) {
      modalMenuGrid.innerHTML = `
        <div class="error-state" style="grid-column: 1 / -1; padding: 20px;">
          <i class="fa-solid fa-info-circle"></i> Mitra ini belum menambahkan menu sehat untuk saat ini.
        </div>
      `;
    } else {
      modalMenuGrid.innerHTML = partner.menu.map(item => `
        <div class="menu-item-card">
          <img src="${item.image}" alt="${item.name}" class="menu-item-img">
          <div class="menu-item-info">
            <div class="menu-item-title-row">
              <span class="menu-item-name">${item.name}</span>
              <span class="menu-item-price">Rp ${item.price.toLocaleString('id-ID')}</span>
            </div>
            <p class="menu-item-desc">${item.description || '-'}</p>
            
            <!-- Nutrition Fact Details -->
            <div class="menu-item-nutrition">
              <div class="nutrition-title">Gizi per Porsi</div>
              <div class="nutrition-grid">
                <div class="nutrition-fact">
                  <strong>${item.calories}</strong>
                  kkal
                </div>
                <div class="nutrition-fact">
                  <strong>${item.protein}g</strong>
                  prot
                </div>
                <div class="nutrition-fact">
                  <strong>${item.carbs}g</strong>
                  karb
                </div>
                <div class="nutrition-fact">
                  <strong>${item.fat}g</strong>
                  lemak
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Open Modal
    partnerModal.classList.add('open');
    document.body.style.overflow = 'hidden'; // prevent background scrolling
  };

  const closeModal = () => {
    partnerModal.classList.remove('open');
    document.body.style.overflow = 'auto'; // restore scroll
  };

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  
  // Close modal when clicking outside container
  if (partnerModal) {
    partnerModal.addEventListener('click', (e) => {
      if (e.target === partnerModal) {
        closeModal();
      }
    });
  }

  // Handle escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
});
