document.addEventListener('DOMContentLoaded', () => {
  // --- GLOBAL FETCH INTERCEPTOR FOR AUTH ---
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch(...args).then(response => {
      if (response.status === 401) {
        if (typeof showToast === 'function') {
          showToast('Sesi Anda telah berakhir. Mengalihkan ke halaman login...', 'error');
        }
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
      return response;
    });
  };

  // --- STATE ---
  let partnersList = [];
  let selectedPartnerForMenu = null;

  // --- DOM ELEMENTS ---
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.content-section');
  const pageTitle = document.getElementById('pageTitle');

  // Dashboard elements
  const dashViews = document.getElementById('dashViews');
  const dashDownloads = document.getElementById('dashDownloads');
  const dashPartners = document.getElementById('dashPartners');
  const conversionVal = document.getElementById('conversionVal');
  const conversionCircle = document.getElementById('conversionCircle');
  const recentPartnersList = document.getElementById('recentPartnersList');

  // Partners elements
  const partnersTableBody = document.getElementById('partnersTableBody');
  const searchPartnerInput = document.getElementById('searchPartnerInput');
  const openAddPartnerBtn = document.getElementById('openAddPartnerBtn');
  const partnerModal = document.getElementById('partnerModal');
  const closePartnerModalBtn = document.getElementById('closePartnerModalBtn');
  const cancelPartnerModalBtn = document.getElementById('cancelPartnerModalBtn');
  const partnerForm = document.getElementById('partnerForm');
  const partnerIdField = document.getElementById('partnerIdField');
  const partnerModalTitle = document.getElementById('partnerModalTitle');
  const savePartnerBtn = document.getElementById('savePartnerBtn');

  // Partner Form inputs
  const partnerName = document.getElementById('partnerName');
  const partnerDescription = document.getElementById('partnerDescription');
  
  // Tag input elements
  const tagInput = document.getElementById('tagInput');
  const tagsList = document.getElementById('tagsList');
  let activePartnerTags = [];

  // Helper to render tag pills
  function renderTags() {
    if (!tagsList) return;
    tagsList.innerHTML = activePartnerTags.map((tag, index) => `
      <div class="tag-pill">
        <span>${tag}</span>
        <button type="button" class="tag-pill-remove" onclick="removeTag(${index})">&times;</button>
      </div>
    `).join('');
  }

  // Exposed remove tag helper
  window.removeTag = function(index) {
    activePartnerTags.splice(index, 1);
    renderTags();
  };

  function addTagFromInput() {
    if (!tagInput) return;
    let value = tagInput.value.trim().replace(/,/g, '');
    if (value) {
      // Normalize to Title Case (e.g. "sehat" -> "Sehat", "low carb" -> "Low Carb")
      value = value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      
      const exists = activePartnerTags.some(t => t.toLowerCase() === value.toLowerCase());
      if (!exists) {
        activePartnerTags.push(value);
        renderTags();
      }
    }
    tagInput.value = '';
  }

  if (tagInput) {
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagFromInput();
      } else if (e.key === ',') {
        e.preventDefault();
        addTagFromInput();
      } else if (e.key === 'Backspace' && tagInput.value === '' && activePartnerTags.length > 0) {
        activePartnerTags.pop();
        renderTags();
      }
    });

    tagInput.addEventListener('blur', () => {
      addTagFromInput();
    });
  }

  const partnerPhone = document.getElementById('partnerPhone');
  const partnerAddress = document.getElementById('partnerAddress');
  const partnerLogoInput = document.getElementById('partnerLogoInput');
  const partnerLogoPreview = document.getElementById('partnerLogoPreview');
  const partnerLogoUrl = document.getElementById('partnerLogoUrl');

  // Menu elements
  const selectPartnerMenu = document.getElementById('selectPartnerMenu');
  const openAddMenuBtn = document.getElementById('openAddMenuBtn');
  const menuContentPlaceholder = document.getElementById('menuContentPlaceholder');
  const menuTableWrapper = document.getElementById('menuTableWrapper');
  const menuTableBody = document.getElementById('menuTableBody');
  const menuModal = document.getElementById('menuModal');
  const closeMenuModalBtn = document.getElementById('closeMenuModalBtn');
  const cancelMenuModalBtn = document.getElementById('cancelMenuModalBtn');
  const menuForm = document.getElementById('menuForm');
  
  // Menu Form inputs
  const menuPartnerIdField = document.getElementById('menuPartnerIdField');
  const menuName = document.getElementById('menuName');
  const menuPrice = document.getElementById('menuPrice');
  const menuDescription = document.getElementById('menuDescription');
  const menuCalories = document.getElementById('menuCalories');
  const menuProtein = document.getElementById('menuProtein');
  const menuCarbs = document.getElementById('menuCarbs');
  const menuFat = document.getElementById('menuFat');
  const menuImageInput = document.getElementById('menuImageInput');
  const menuImagePreview = document.getElementById('menuImagePreview');
  const menuImageUrl = document.getElementById('menuImageUrl');

  // Toast container
  const toastContainer = document.getElementById('toastContainer');

  // Orders elements
  const ordersTableBody = document.getElementById('ordersTableBody');
  const filterOrderStatus = document.getElementById('filterOrderStatus');
  const ordersTotalCount = document.getElementById('ordersTotalCount');
  const ordersTotalRevenue = document.getElementById('ordersTotalRevenue');
  const ordersTodayCount = document.getElementById('ordersTodayCount');
  const topMenusStatsBody = document.getElementById('topMenusStatsBody');
  const topPartnersStatsBody = document.getElementById('topPartnersStatsBody');

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = document.createElement('i');
    if (type === 'success') {
      icon.className = 'fa-solid fa-circle-check';
    } else {
      icon.className = 'fa-solid fa-circle-exclamation';
    }
    
    const textNode = document.createTextNode(message);
    
    toast.appendChild(icon);
    toast.appendChild(textNode);
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- SIDEBAR NAVIGATION ---
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Deactivate all items and sections
      menuItems.forEach(m => m.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      // Activate clicked item and corresponding section
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      targetSection.classList.add('active');

      // Update Topbar Title
      const text = item.textContent.trim();
      pageTitle.textContent = text;

      // Special action on page switch
      if (targetId === 'section-dashboard') {
        loadDashboardData();
      } else if (targetId === 'section-partners') {
        loadPartnersTable();
      } else if (targetId === 'section-menu') {
        loadPartnersDropdown();
      } else if (targetId === 'section-orders') {
        loadOrdersManagement();
      }
    });
  });

  // --- DASHBOARD ANALYTICS ---
  function loadDashboardData() {
    fetch('/api/v1/analytics')
      .then(res => res.json())
      .then(data => {
        // Load stats
        dashViews.textContent = data.pageViews.toLocaleString('id-ID');
        dashDownloads.textContent = data.downloads.toLocaleString('id-ID');
        dashPartners.textContent = data.partnersCount.toLocaleString('id-ID');

        // Conversion Rate
        const rate = data.pageViews > 0 ? Math.round((data.downloads / data.pageViews) * 100) : 0;
        conversionVal.textContent = `${rate}%`;
        
        // Update SVG circle path
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        conversionCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (rate / 100) * circumference;
        conversionCircle.style.strokeDashoffset = offset;
      })
      .catch(err => {
        console.error('Error loading analytics:', err);
        showToast('Gagal memuat analitik dashboard', 'error');
      });

    // Load recent partners
    fetch('/api/v1/partners')
      .then(res => res.json())
      .then(partners => {
        partnersList = partners;
        const sorted = [...partners].reverse().slice(0, 4); // show last 4
        if (sorted.length === 0) {
          recentPartnersList.innerHTML = '<li class="recent-item">Belum ada mitra terdaftar.</li>';
          return;
        }

        recentPartnersList.innerHTML = sorted.map(p => `
          <li class="recent-item">
            <div class="recent-profile">
              <img src="${p.logo}" alt="${p.name}" class="recent-logo">
              <div>
                <span class="recent-name">${p.name}</span>
                <span class="recent-category">${p.category}</span>
              </div>
            </div>
            <span class="recent-time">⭐ ${p.rating}</span>
          </li>
        `).join('');
      })
      .catch(err => console.error('Error fetching recent partners:', err));
  }

  // Run Dashboard load on startup
  loadDashboardData();

  // --- IMAGE UPLOAD HANDLING ---
  function handleImageUpload(inputElement, previewElement, urlFieldElement) {
    inputElement.addEventListener('change', () => {
      const file = inputElement.files[0];
      if (!file) return;

      // Show temporary preview local URL
      previewElement.src = URL.createObjectURL(file);

      // Upload file to Node.js backend
      const formData = new FormData();
      formData.append('image', file);

      fetch('/api/v1/upload', {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            urlFieldElement.value = data.url;
            showToast('Gambar berhasil diunggah!');
          } else {
            showToast(data.message || 'Gagal mengunggah gambar', 'error');
          }
        })
        .catch(err => {
          console.error('Upload error:', err);
          showToast('Terjadi kesalahan saat mengunggah', 'error');
        });
    });

    // Synchronize direct URL input changes
    urlFieldElement.addEventListener('input', () => {
      if (urlFieldElement.value) {
        previewElement.src = urlFieldElement.value;
      } else {
        previewElement.src = '/images/default-partner.jpg';
      }
    });
  }

  handleImageUpload(partnerLogoInput, partnerLogoPreview, partnerLogoUrl);
  handleImageUpload(menuImageInput, menuImagePreview, menuImageUrl);

  // --- MANAGE PARTNERS (MITRA) ---
  function loadPartnersTable() {
    fetch('/api/v1/partners')
      .then(res => res.json())
      .then(partners => {
        partnersList = partners;
        renderPartnersTable(partners);
      })
      .catch(err => {
        console.error('Error fetching partners table:', err);
        showToast('Gagal mengambil data mitra', 'error');
      });
  }

  function renderPartnersTable(partners) {
    if (partners.length === 0) {
      partnersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-question" style="font-size: 2rem; display:block; margin-bottom:10px;"></i>
            Belum ada mitra terdaftar. Klik "Tambah Mitra Baru" untuk menambahkan.
          </td>
        </tr>
      `;
      return;
    }

    partnersTableBody.innerHTML = partners.map(p => `
      <tr>
        <td>
          <img src="${p.logo}" alt="${p.name}" class="table-logo">
        </td>
        <td>
          <div class="table-name-bold">${p.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${p.description}
          </div>
        </td>
        <td>
          <span class="table-category-badge">${p.category}</span>
        </td>
        <td>
          <div style="font-weight: 500; font-size: 0.85rem;">${p.phone || '-'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${p.address || '-'}
          </div>
        </td>
        <td>
          <span class="table-rating-star"><i class="fa-solid fa-star"></i> ${p.rating}</span>
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-secondary btn-xs" onclick="editPartner('${p.id}')">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button class="btn btn-danger btn-xs" onclick="deletePartner('${p.id}')">
              <i class="fa-solid fa-trash"></i> Hapus
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Filter Search Mitra
  searchPartnerInput.addEventListener('input', () => {
    const q = searchPartnerInput.value.toLowerCase();
    const filtered = partnersList.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
    renderPartnersTable(filtered);
  });

  // Modal Open/Close Partner
  openAddPartnerBtn.addEventListener('click', () => {
    partnerForm.reset();
    partnerIdField.value = '';
    partnerLogoPreview.src = '/images/default-partner.jpg';
    activePartnerTags = [];
    renderTags();
    if (tagInput) tagInput.value = '';
    partnerModalTitle.textContent = 'Tambah Mitra Restoran';
    savePartnerBtn.textContent = 'Simpan Mitra';
    partnerModal.classList.add('open');
  });

  const closePartnerModal = () => {
    partnerModal.classList.remove('open');
  };

  closePartnerModalBtn.addEventListener('click', closePartnerModal);
  cancelPartnerModalBtn.addEventListener('click', closePartnerModal);

  // Submit Partner Form (Add or Edit)
  partnerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = partnerIdField.value;

    if (activePartnerTags.length === 0) {
      showToast('Kategori Sehat wajib diisi minimal satu tag!', 'error');
      return;
    }

    const payload = {
      name: partnerName.value,
      description: partnerDescription.value,
      categories: activePartnerTags,
      phone: partnerPhone.value,
      address: partnerAddress.value,
      logo: partnerLogoUrl.value || '/images/default-partner.jpg'
    };

    const isEdit = id !== '';
    const url = isEdit ? `/api/v1/partners/${id}` : '/api/v1/partners';
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast(`Mitra berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`);
          closePartnerModal();
          loadPartnersTable();
        } else {
          showToast(data.message || 'Gagal menyimpan mitra', 'error');
        }
      })
      .catch(err => {
        console.error('Error saving partner:', err);
        showToast('Terjadi kesalahan pada server', 'error');
      });
  });

  // Edit Partner action window helper
  window.editPartner = function(id) {
    const partner = partnersList.find(p => p.id === id);
    if (!partner) return;

    partnerIdField.value = partner.id;
    partnerName.value = partner.name;
    partnerDescription.value = partner.description;
    
    activePartnerTags = Array.isArray(partner.categories) ? [...partner.categories] : [];
    renderTags();
    if (tagInput) tagInput.value = '';

    partnerPhone.value = partner.phone;
    partnerAddress.value = partner.address;
    partnerLogoUrl.value = partner.logo;
    partnerLogoPreview.src = partner.logo;

    partnerModalTitle.textContent = 'Edit Informasi Mitra';
    savePartnerBtn.textContent = 'Perbarui Mitra';
    partnerModal.classList.add('open');
  };

  // Delete Partner action window helper
  window.deletePartner = function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus mitra ini beserta semua menunya? Tindakan ini tidak bisa dibatalkan.')) return;

    fetch(`/api/v1/partners/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Mitra berhasil dihapus!');
          loadPartnersTable();
        } else {
          showToast(data.message || 'Gagal menghapus mitra', 'error');
        }
      })
      .catch(err => {
        console.error('Error deleting partner:', err);
        showToast('Terjadi kesalahan pada server', 'error');
      });
  };

  // --- KELOLA MENU MAKANAN ---
  function loadPartnersDropdown() {
    fetch('/api/v1/partners')
      .then(res => res.json())
      .then(partners => {
        partnersList = partners;
        
        // Populate dropdown
        let optionsHtml = '<option value="">-- Pilih Mitra Restoran --</option>';
        optionsHtml += partners.map(p => `<option value="${p.id}">${p.name} (${p.category})</option>`).join('');
        selectPartnerMenu.innerHTML = optionsHtml;

        // Reset state
        selectedPartnerForMenu = null;
        openAddMenuBtn.disabled = true;
        menuTableWrapper.style.display = 'none';
        menuContentPlaceholder.style.display = 'block';
        menuContentPlaceholder.innerHTML = `<i class="fa-solid fa-store-slash"></i> Silakan pilih mitra restoran di atas untuk melihat dan mengelola menu sehat mereka.`;
      })
      .catch(err => {
        console.error('Error loading dropdown partners:', err);
        showToast('Gagal memuat dropdown restoran', 'error');
      });
  }

  // Handle selected partner change
  selectPartnerMenu.addEventListener('change', () => {
    const id = selectPartnerMenu.value;
    if (!id) {
      selectedPartnerForMenu = null;
      openAddMenuBtn.disabled = true;
      menuTableWrapper.style.display = 'none';
      menuContentPlaceholder.style.display = 'block';
      return;
    }

    fetchPartnerMenu(id);
  });

  function fetchPartnerMenu(partnerId) {
    fetch(`/api/v1/partners/${partnerId}`)
      .then(res => res.json())
      .then(partner => {
        selectedPartnerForMenu = partner;
        openAddMenuBtn.disabled = false;
        renderMenuTable(partner.menu);
      })
      .catch(err => {
        console.error('Error loading menu details:', err);
        showToast('Gagal memuat detail menu restoran', 'error');
      });
  }

  function renderMenuTable(menu) {
    menuContentPlaceholder.style.display = 'none';
    menuTableWrapper.style.display = 'block';

    if (menu.length === 0) {
      menuTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-bowl-food" style="font-size: 2rem; display:block; margin-bottom:10px;"></i>
            Belum ada menu terdaftar untuk mitra ini. Klik "Tambah Menu Makanan Baru" untuk mengisi.
          </td>
        </tr>
      `;
      return;
    }

    menuTableBody.innerHTML = menu.map(m => `
      <tr>
        <td>
          <img src="${m.image}" alt="${m.name}" class="menu-table-img">
        </td>
        <td>
          <div class="table-name-bold">${m.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 250px;">
            ${m.description || '-'}
          </div>
        </td>
        <td>
          <span style="font-weight: 700; color: var(--primary);">Rp ${m.price.toLocaleString('id-ID')}</span>
        </td>
        <td>
          <div style="font-size: 0.9rem; font-weight: 600;">
            ${m.calories} Kkal
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            P: ${m.protein}g | K: ${m.carbs}g | L: ${m.fat}g
          </div>
        </td>
        <td>
          <button class="btn btn-danger btn-xs" onclick="deleteMenuItem('${selectedPartnerForMenu.id}', '${m.id}')">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </td>
      </tr>
    `).join('');
  }

  // Modal Menu Open/Close
  openAddMenuBtn.addEventListener('click', () => {
    if (!selectedPartnerForMenu) return;
    
    menuForm.reset();
    menuPartnerIdField.value = selectedPartnerForMenu.id;
    menuImagePreview.src = '/images/default-food.jpg';
    menuModalTitle.textContent = `Tambah Menu untuk: ${selectedPartnerForMenu.name}`;
    menuModal.classList.add('open');
  });

  const closeMenuModal = () => {
    menuModal.classList.remove('open');
  };

  closeMenuModalBtn.addEventListener('click', closeMenuModal);
  cancelMenuModalBtn.addEventListener('click', closeMenuModal);

  // Submit Menu Form (Add Menu)
  menuForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const partnerId = menuPartnerIdField.value;

    const payload = {
      name: menuName.value,
      price: Number(menuPrice.value),
      description: menuDescription.value,
      calories: Number(menuCalories.value) || 0,
      protein: Number(menuProtein.value) || 0,
      carbs: Number(menuCarbs.value) || 0,
      fat: Number(menuFat.value) || 0,
      image: menuImageUrl.value || '/images/default-food.jpg'
    };

    fetch(`/api/v1/partners/${partnerId}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Menu makanan berhasil ditambahkan!');
          closeMenuModal();
          fetchPartnerMenu(partnerId); // Refresh table
        } else {
          showToast(data.message || 'Gagal menyimpan menu', 'error');
        }
      })
      .catch(err => {
        console.error('Error saving menu:', err);
        showToast('Terjadi kesalahan pada server', 'error');
      });
  });

  // Delete Menu Item action window helper
  window.deleteMenuItem = function(partnerId, menuId) {
    if (!confirm('Apakah Anda yakin ingin menghapus menu makanan ini?')) return;

    fetch(`/api/v1/partners/${partnerId}/menu/${menuId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Menu makanan berhasil dihapus!');
          fetchPartnerMenu(partnerId); // Refresh table
        } else {
          showToast(data.message || 'Gagal menghapus menu', 'error');
        }
      })
      .catch(err => {
        console.error('Error deleting menu item:', err);
        showToast('Terjadi kesalahan pada server', 'error');
      });
  };

  // --- MANAJEMEN PESANAN (ORDERS) ---
  if (filterOrderStatus) {
    filterOrderStatus.addEventListener('change', () => {
      loadOrdersList();
    });
  }

  function loadOrdersManagement() {
    loadOrdersStats();
    loadOrdersList();
  }

  function loadOrdersStats() {
    fetch('/api/v1/admin/orders/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const stats = data.stats;
          ordersTotalCount.textContent = stats.total_orders.toLocaleString('id-ID');
          ordersTotalRevenue.textContent = `Rp ${stats.total_revenue.toLocaleString('id-ID')}`;
          ordersTodayCount.textContent = stats.today_orders.toLocaleString('id-ID');

          // Render top 5 menus
          if (stats.top_menus.length === 0) {
            topMenusStatsBody.innerHTML = '<tr><td colspan="2" class="text-center">Belum ada data menu terlaris</td></tr>';
          } else {
            topMenusStatsBody.innerHTML = stats.top_menus.map(m => `
              <tr>
                <td>${m.menu_name}</td>
                <td class="text-center" style="font-weight: bold;">${m.total_qty} porsi</td>
              </tr>
            `).join('');
          }

          // Render top 5 partners
          if (stats.top_partners.length === 0) {
            topPartnersStatsBody.innerHTML = '<tr><td colspan="2" class="text-center">Belum ada data mitra teraktif</td></tr>';
          } else {
            topPartnersStatsBody.innerHTML = stats.top_partners.map(p => `
              <tr>
                <td>${p.partner_name}</td>
                <td class="text-center" style="font-weight: bold;">${p.total_orders} pesanan</td>
              </tr>
            `).join('');
          }
        } else {
          showToast(data.message || 'Gagal memuat statistik pesanan', 'error');
        }
      })
      .catch(err => {
        console.error('Error fetching orders stats:', err);
        showToast('Gagal memuat statistik pesanan', 'error');
      });
  }

  function loadOrdersList() {
    const statusFilter = filterOrderStatus.value;
    const url = statusFilter ? `/api/v1/admin/orders?status=${statusFilter}` : '/api/v1/admin/orders';
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderOrdersTable(data.orders);
        } else {
          showToast(data.message || 'Gagal memuat daftar pesanan', 'error');
        }
      })
      .catch(err => {
        console.error('Error fetching orders list:', err);
        showToast('Gagal memuat daftar pesanan', 'error');
      });
  }

  function renderOrdersTable(orders) {
    if (!orders || orders.length === 0) {
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-receipt" style="font-size: 2rem; display:block; margin-bottom:10px;"></i>
            Tidak ada pesanan ditemukan.
          </td>
        </tr>
      `;
      return;
    }

    ordersTableBody.innerHTML = orders.map(o => {
      // Formatted date
      let dateStr = '-';
      try {
        const d = new Date(o.created_at);
        dateStr = d.toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        dateStr = o.created_at || '-';
      }

      // Order items list as HTML
      const itemsHtml = o.items && o.items.length > 0 
        ? `<ul class="order-items-list">${o.items.map(item => `<li>${item.menu_name} (${item.qty}x)</li>`).join('')}</ul>`
        : '-';

      // Status class modifier
      const statusClass = `status-${o.status || 'pending'}`;

      // Dropdown selector for status update
      const statuses = ['pending', 'processing', 'completed', 'cancelled'];
      // If the order has status 'success' (from old records), let's include it or display completed
      const currentStatus = o.status === 'success' ? 'completed' : o.status;
      
      const selectOptions = statuses.map(s => {
        const selectedAttr = s === currentStatus ? 'selected' : '';
        const displayLabel = s.charAt(0).toUpperCase() + s.slice(1);
        return `<option value="${s}" ${selectedAttr}>${displayLabel}</option>`;
      }).join('');

      return `
        <tr>
          <td><code style="font-weight: 600; font-size: 0.85rem;">${o.id.substring(0, 8)}...</code></td>
          <td><span style="font-weight: 500;">${o.user_name || 'User Terhapus'}</span></td>
          <td><span style="font-weight: 500;">${o.partner_name}</span></td>
          <td><span style="font-weight: 700; color: var(--primary);">Rp ${o.total_price.toLocaleString('id-ID')}</span></td>
          <td><span class="status-badge ${statusClass}">${o.status}</span></td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
          <td>${itemsHtml}</td>
          <td>
            <select class="action-select" onchange="updateOrderStatus('${o.id}', this.value)">
              ${selectOptions}
            </select>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Exposed update status helper
  window.updateOrderStatus = function(orderId, newStatus) {
    fetch(`/api/v1/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Status pesanan berhasil diperbarui!');
          // Refresh list and stats to update totals & graphs
          loadOrdersManagement();
        } else {
          showToast(data.message || 'Gagal memperbarui status pesanan', 'error');
        }
      })
      .catch(err => {
        console.error('Error updating order status:', err);
        showToast('Terjadi kesalahan pada server', 'error');
      });
  };
});
