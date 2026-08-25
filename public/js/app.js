// Crystal Agro CRM - Frontend App Logic
document.addEventListener('DOMContentLoaded', () => {
    // App State & Auth
    let currentUser = JSON.parse(localStorage.getItem('crystal_crm_user') || 'null');
    let categoriesList = [];
    let partsList = [];
    let vendorsList = [];
    let isLowStockFilterActive = false;
    let currentTab = 'dashboard';
    const permissionModules = [
        ['dashboard', 'Dashboard'], ['master_parts', 'Master Parts'], ['planner', 'Material Planner'],
        ['categories', 'Categories'], ['inventory', 'Inventory'], ['transactions', 'Stock Transactions'],
        ['vendors', 'Vendors'], ['billing', 'Purchase & Billing'], ['users', 'Users & Permissions']
    ];

    function hasPermission(module, action = 'view') {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        return Boolean(currentUser.permissions?.[module]?.[action]);
    }
    window.hasPermission = hasPermission;

    // Theme Management
    const savedTheme = localStorage.getItem('crystal_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('crystal_theme', newTheme);
        updateThemeUI(newTheme);
    }

    function updateThemeUI(theme) {
        const themeText = document.getElementById('dropdown-theme-text');
        const themeIcon = document.getElementById('dropdown-theme-icon');
        if (themeText) {
            themeText.innerText = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
        }
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fa-solid fa-moon text-primary' : 'fa-solid fa-sun text-warning';
        }
    }

    // Dropdown Profile Menu Trigger & Outside Click Handler
    const headerUserTrigger = document.getElementById('user-header-trigger');
    const headerDropdownMenu = document.getElementById('user-dropdown-menu');

    headerUserTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        headerDropdownMenu?.classList.toggle('show');
        headerUserTrigger?.classList.toggle('active');
    });

    document.getElementById('dropdown-theme-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTheme();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-header-menu-container')) {
            headerDropdownMenu?.classList.remove('show');
            headerUserTrigger?.classList.remove('active');
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
    // ═══════════════════════════════════════════════════════════════════════
    function checkAuth() {
        const loginScreen = document.getElementById('login-screen');
        if (!currentUser) {
            if (loginScreen) loginScreen.style.display = 'flex';
            return false;
        } else {
            if (loginScreen) loginScreen.style.display = 'none';
            updateUserProfileUI();
            applyRolePermissions();
            return true;
        }
    }

    function updateUserProfileUI() {
        if (!currentUser) return;
        const initials = (currentUser.full_name || currentUser.username).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';

        // Header pill
        const headerName = document.getElementById('header-user-name');
        const headerRole = document.getElementById('header-user-role');
        const headerAvatar = document.getElementById('header-user-avatar');
        if (headerName) headerName.innerText = currentUser.full_name;
        if (headerRole) headerRole.innerText = formatRoleName(currentUser.role);
        if (headerAvatar) headerAvatar.innerText = initials;

        // Dropdown card
        const dropAvatar = document.getElementById('dropdown-user-avatar');
        const dropName = document.getElementById('dropdown-user-fullname');
        const dropUsername = document.getElementById('dropdown-user-username');
        const dropRoleBadge = document.getElementById('dropdown-user-role-badge');
        const dropPerms = document.getElementById('dropdown-user-perms');

        if (dropAvatar) dropAvatar.innerText = initials;
        if (dropName) dropName.innerText = currentUser.full_name;
        if (dropUsername) dropUsername.innerText = `@${currentUser.username}`;
        if (dropRoleBadge) {
            dropRoleBadge.innerText = (currentUser.role || 'USER').toUpperCase();
        }
        if (dropPerms) {
            const visibleSections = permissionModules.filter(([module]) => hasPermission(module, 'view')).length;
            dropPerms.innerHTML = `<span class="permission-pill granted"><i class="fa-solid fa-check"></i> ${visibleSections} sections</span>`;
        }

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        updateThemeUI(currentTheme);
    }

    function formatRoleName(role) {
        switch (role) {
            case 'admin': return 'System Administrator';
            case 'store': return 'Store Manager';
            case 'planner': return 'Production Planner';
            case 'vendor': return 'Vendor / Supplier';
            default: return role || 'User';
        }
    }

    function applyRolePermissions() {
        if (!currentUser) return;

        // Hide sections the current user cannot view.
        document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
            const module = item.dataset.tab === 'master-parts' ? 'master_parts' : item.dataset.tab;
            item.style.display = hasPermission(module, 'view') ? 'flex' : 'none';
        });

        // Admin Only navigation heading & settings
        const isAdmin = currentUser.role === 'admin';
        const adminSection = document.getElementById('nav-section-admin');
        const usersNavItem = document.getElementById('nav-item-users');
        const settingsNavItem = document.getElementById('nav-item-settings');
        const settingsDropdownBtn = document.getElementById('dropdown-btn-open-settings');
        const sidebarBrand = document.getElementById('sidebar-company-brand');

        if (!hasPermission('users', 'view') && !isAdmin) {
            if (adminSection) adminSection.style.display = 'none';
            if (usersNavItem) usersNavItem.style.display = 'none';
        } else {
            if (adminSection) adminSection.style.display = 'block';
            if (usersNavItem) usersNavItem.style.display = hasPermission('users', 'view') ? 'flex' : 'none';
        }

        if (settingsNavItem) settingsNavItem.style.display = isAdmin ? 'flex' : 'none';
        if (settingsDropdownBtn) settingsDropdownBtn.style.display = isAdmin ? 'flex' : 'none';
        if (sidebarBrand) {
            sidebarBrand.style.cursor = isAdmin ? 'pointer' : 'default';
            sidebarBrand.title = isAdmin ? 'Click to view/edit Company Profile & Logo' : 'Crystal Agro Industrial CRM';
        }

        const createControls = {
            master_parts: ['#btn-add-part', '#btn-open-create-master-part', '#btn-planner-create-part', '#btn-save-master-part'],
            categories: ['#btn-open-create-category-page', '#btn-quick-cat-part-modal', '#btn-quick-cat-mp'],
            inventory: ['#btn-stock-adjust'], vendors: ['#btn-add-vendor'],
            billing: ['#btn-create-bill'], users: ['#btn-open-create-user']
        };
        Object.entries(createControls).forEach(([module, selectors]) => selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.style.display = hasPermission(module, 'create') ? 'inline-flex' : 'none');
        }));
        document.querySelectorAll('[data-create-module]').forEach(el => el.style.display = hasPermission(el.dataset.createModule, 'create') ? 'inline-flex' : 'none');
        document.querySelectorAll('[data-view-module]').forEach(el => el.style.display = hasPermission(el.dataset.viewModule, 'view') ? 'inline-flex' : 'none');
    }

    // Quick 1-Click Demo Login
    window.quickLoginDemo = async function(username, password) {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (uInput) uInput.value = username;
        if (pInput) pInput.value = password;
        await performLogin(username, password);
    };

    async function performLogin(username, password) {
        const errorEl = document.getElementById('login-error-msg');
        const submitBtn = document.getElementById('btn-login-submit');
        if (errorEl) errorEl.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
        }

        try {
            const res = await API.login({ username, password });
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal';
            }

            if (res.success && res.user) {
                currentUser = res.user;
                localStorage.setItem('crystal_crm_user', JSON.stringify(currentUser));
                checkAuth();
                showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
                switchTab('dashboard');
            } else {
                if (errorEl) {
                    errorEl.innerText = res.message || 'Invalid username or password';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal';
            }
            if (errorEl) {
                errorEl.innerText = 'Connection error. Please try again.';
                errorEl.style.display = 'block';
            }
        }
    }

    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        await performLogin(u, p);
    });

    document.getElementById('btn-toggle-login-pwd')?.addEventListener('click', () => {
        const pwdInput = document.getElementById('login-password');
        const icon = document.querySelector('#btn-toggle-login-pwd i');
        if (pwdInput && icon) {
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.className = 'fa-solid fa-eye-slash';
            } else {
                pwdInput.type = 'password';
                icon.className = 'fa-solid fa-eye';
            }
        }
    });

    // Logout
    async function handleLogout() {
        if (confirm('Are you sure you want to sign out?')) {
            headerDropdownMenu?.classList.remove('show');
            headerUserTrigger?.classList.remove('active');
            try { await API.logout(); } catch (err) { console.warn('Server logout failed', err); }
            localStorage.removeItem('crystal_crm_user');
            currentUser = null;
            checkAuth();
            showToast('Signed out successfully', 'success');
        }
    }
    window.handleLogout = handleLogout;
    document.getElementById('btn-top-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-sidebar-logout')?.addEventListener('click', handleLogout);

    // Navigation Tab Switching
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    function switchTab(tabName) {
        const requestedModule = tabName === 'master-parts' ? 'master_parts' : tabName;
        if (!hasPermission(requestedModule, 'view')) {
            showToast('You do not have permission to view this section', 'error');
            return;
        }
        currentTab = tabName;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById(`tab-${tabName}-view`)?.classList.add('active');

        const headerActions = document.getElementById('header-actions');
        const kpiGrid       = document.getElementById('kpi-grid');

        if (kpiGrid) kpiGrid.style.display = 'none';

        if (tabName === 'dashboard') {
            document.getElementById('page-title').innerText = 'Executive & Operations Dashboard';
            document.getElementById('page-subtitle').innerText = 'Real-time overview of parts catalog, inventory valuation, stock movements, and quick operations';
            if (headerActions) headerActions.style.display = 'none';
            loadDashboardData();
        } else if (tabName === 'users') {
            document.getElementById('page-title').innerText = 'Users & Role Permissions (RBAC)';
            document.getElementById('page-subtitle').innerText = 'Manage system user accounts, assigned roles, and granular Add/Edit/Delete action permissions';
            if (headerActions) headerActions.style.display = 'none';
            loadUsersData();
        } else if (tabName === 'master-parts') {
            document.getElementById('page-title').innerText = 'Master Parts Catalog';
            document.getElementById('page-subtitle').innerText = 'Material specifications database with drawing numbers, dimensions, and materials list';
            if (headerActions) headerActions.style.display = 'none';
            loadMasterPartsData();
        } else if (tabName === 'categories') {
            document.getElementById('page-title').innerText = 'Category Management';
            document.getElementById('page-subtitle').innerText = 'Directory of material and component categories with part associations';
            if (headerActions) headerActions.style.display = 'none';
            loadCategoriesPageData();
        } else if (tabName === 'inventory') {
            document.getElementById('page-title').innerText = 'Inventory Stock & Valuations';
            document.getElementById('page-subtitle').innerText = 'Real-time parts stock balances, valuation, and threshold alerts';
            if (headerActions) headerActions.style.display = 'none';
            if (kpiGrid) kpiGrid.style.display = 'grid';
            loadInventoryData();
        } else if (tabName === 'transactions') {
            document.getElementById('page-title').innerText = 'Stock Transactions Log';
            document.getElementById('page-subtitle').innerText = 'Complete audit log of all manual and automated stock movements';
            if (headerActions) headerActions.style.display = 'none';
            loadTransactionsData();
        } else if (tabName === 'vendors') {
            document.getElementById('page-title').innerText = 'Vendor Management';
            document.getElementById('page-subtitle').innerText = 'Supplier directory, tax registration, and payment terms';
            if (headerActions) headerActions.style.display = 'none';
            loadVendorsData();
        } else if (tabName === 'billing') {
            document.getElementById('page-title').innerText = 'Multi-Vendor Purchase & Billing';
            document.getElementById('page-subtitle').innerText = 'Purchase invoices, GST calculations, automatic stock IN receiving, and PDF bill printing';
            if (headerActions) headerActions.style.display = 'none';
            loadPurchaseBillsData();
        } else if (tabName === 'planner') {
            document.getElementById('page-title').innerText = 'Material Planner & Purchasing Calculator';
            document.getElementById('page-subtitle').innerText = 'Calculate raw material purchasing requirements based on target build quantities';
            if (headerActions) headerActions.style.display = 'none';
            loadMaterialPlannerData();
        }
    }
    window.switchTab = switchTab;

    // Toast Notification System
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Modal Control Helpers
    function openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    function closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // 1. Load Categories
    async function loadCategories() {
        try {
            const res = await API.getCategories();
            if (res.success) {
                categoriesList = res.data || [];
                populateCategorySelects();
                const catBadge = document.getElementById('sidebar-categories-count');
                if (catBadge) catBadge.innerText = categoriesList.length;
            }
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    }
    window.loadCategories = loadCategories;

    function populateCategorySelects() {
        const partCategory = document.getElementById('part-category');
        const masterPartsFilter = document.getElementById('master-parts-filter-category');
        const inventoryFilter = document.getElementById('filter-category');
        const plannerCat = document.getElementById('mp-category-id');

        const currentPartCatVal = partCategory ? partCategory.value : '';
        const currentMpFilterVal = masterPartsFilter ? masterPartsFilter.value : 'all';

        if (partCategory) {
            partCategory.innerHTML = '<option value="">Select Category...</option>' + 
                categoriesList.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            if (currentPartCatVal) partCategory.value = currentPartCatVal;
        }

        if (masterPartsFilter) {
            masterPartsFilter.innerHTML = '<option value="all">All Categories</option>' + 
                categoriesList.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            if (currentMpFilterVal) masterPartsFilter.value = currentMpFilterVal;
        }

        if (inventoryFilter) {
            inventoryFilter.innerHTML = '<option value="all">All Categories</option>' + 
                categoriesList.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }

        if (plannerCat) {
            const currentPlannerCat = plannerCat.value;
            plannerCat.innerHTML = '<option value="">-- Select Category --</option>' + 
                categoriesList.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            if (currentPlannerCat) plannerCat.value = currentPlannerCat;
        }

        const catBadge = document.getElementById('sidebar-categories-count');
        if (catBadge) catBadge.innerText = categoriesList.length;
    }
    window.populateCategorySelects = populateCategorySelects;

    // 2. Load Stats
    async function loadStats() {
        try {
            const res = await API.getInventoryStats();
            if (res.success) {
                const s = res.data;
                document.getElementById('kpi-total-parts').innerText = s.totalParts;
                document.getElementById('sidebar-parts-count').innerText = s.totalParts;
                document.getElementById('kpi-stock-value').innerText = `₹${s.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-low-stock-count').innerText = s.lowStockCount;
                document.getElementById('kpi-total-tx').innerText = s.totalTransactions;
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    // 3. Load Parts Inventory
    async function loadInventoryData() {
        loadStats();
        const search = document.getElementById('inventory-search')?.value || '';
        const category_id = document.getElementById('filter-category')?.value || 'all';

        const params = { in_inventory: '1' };
        if (search) params.search = search;
        if (category_id && category_id !== 'all') params.category_id = category_id;
        if (isLowStockFilterActive) params.low_stock = 'true';

        try {
            const res = await API.getParts(params);
            if (res.success) {
                partsList = res.data;
                renderPartsTable(partsList);
                populatePartSelectForTx(partsList);
            }
        } catch (err) {
            console.error('Failed to load inventory parts:', err);
        }
    }

    function renderPartsTable(parts) {
        const tbody = document.getElementById('parts-table-body');
        document.getElementById('showing-records-text').innerText = `Showing ${parts.length} items in inventory stock`;

        if (parts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-box-open fa-2x"></i>
                        <p class="mt-2">No inventory parts found in stock. Click <strong>Add Inventory</strong> to add items to stock.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = parts.map(p => {
            let statusBadge = '';
            if (p.stock_status === 'OUT_OF_STOCK') {
                statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>`;
            } else if (p.stock_status === 'LOW_STOCK') {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> Low Stock (${p.current_stock} / min ${p.min_stock_level})</span>`;
            } else {
                statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> In Stock</span>`;
            }

            const specs = [
                p.material_grade ? `Grade: ${p.material_grade}` : null,
                p.diameter ? `Dia: ${p.diameter}mm` : null,
                p.length ? `Len: ${p.length}mm` : null,
                p.specifications ? p.specifications : null
            ].filter(Boolean).join(' | ') || 'N/A';

            return `
                <tr>
                    <td><strong>${p.part_code}</strong></td>
                    <td>
                        <span class="part-title">${p.part_name}</span>
                        <span class="part-category-tag"><i class="fa-solid fa-folder"></i> ${p.category_name}</span>
                    </td>
                    <td><code>${p.drawing_number || '-'}</code></td>
                    <td><small class="text-muted">${specs}</small></td>
                    <td><span class="badge badge-outline"><i class="fa-solid fa-location-dot"></i> ${p.location || 'Rack N/A'}</span></td>
                    <td>₹${(p.unit_price || 0).toFixed(2)}</td>
                    <td class="text-center">
                        <strong style="font-size: 1.05rem; color:var(--text-main);">${p.current_stock}</strong> <small class="text-muted">${p.unit_of_measure}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="text-right">
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items:center;">
                            ${hasPermission('transactions', 'view') ? `<button class="btn btn-icon btn-sm btn-part-history" data-id="${p.id}" title="View Part History Log">
                                <i class="fa-solid fa-clock-rotate-left text-warning"></i>
                            </button>` : ''}
                            ${hasPermission('inventory', 'create') ? `<button class="btn btn-outline btn-sm btn-quick-tx" data-id="${p.id}" title="Quick Stock IN / OUT">
                                <i class="fa-solid fa-right-left text-primary"></i> Stock IN/OUT
                            </button>` : ''}
                            ${hasPermission('inventory', 'edit') ? `<button class="btn btn-icon btn-sm btn-edit-inv-item" data-id="${p.id}" title="Edit Inventory Details">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>` : ''}
                            ${hasPermission('inventory', 'delete') ? `<button class="btn btn-icon btn-sm btn-remove-inv" data-id="${p.id}" data-name="${p.part_name.replace(/"/g, '&quot;')}" title="Remove from Inventory Stock">
                                <i class="fa-solid fa-box-archive text-danger"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach Row Event Listeners
        document.querySelectorAll('.btn-part-history').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = btn.getAttribute('data-id');
                openPartHistoryModal(partId);
            });
        });

        document.querySelectorAll('.btn-quick-tx').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = btn.getAttribute('data-id');
                document.getElementById('tx-part-id').value = partId;
                openModal('modal-stock-tx');
            });
        });

        document.querySelectorAll('.btn-edit-inv-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = btn.getAttribute('data-id');
                openEditInventoryItemModal(partId);
            });
        });

        document.querySelectorAll('.btn-remove-inv').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = btn.getAttribute('data-id');
                const partName = btn.getAttribute('data-name');
                confirmRemoveFromInventory(partId, partName);
            });
        });
    }

    // Modal handlers for assigning Master Parts to inventory.
    let inventoryMasterParts = [];

    function renderInventoryPartOptions(query = '') {
        const options = document.getElementById('inv-item-master-options');
        if (!options) return;
        const term = query.trim().toLowerCase();
        const matches = inventoryMasterParts.filter(p => {
            const text = `${p.part_name} ${p.part_code || ''} ${p.drawing_number || ''} ${p.category_name || ''}`.toLowerCase();
            return !term || text.includes(term);
        }).slice(0, 50);
        options.innerHTML = matches.length ? matches.map(p => `
            <button type="button" class="searchable-select-option" data-id="${p.id}">
                <strong>${p.part_name}</strong>
                <span>${p.part_code || 'No code'}${p.drawing_number ? ` · Drg: ${p.drawing_number}` : ''}</span>
            </button>`).join('') : '<div class="searchable-select-empty">No Master Part found</div>';
        options.classList.add('show');
        options.querySelectorAll('[data-id]').forEach(option => option.addEventListener('click', () => {
            const part = inventoryMasterParts.find(p => String(p.id) === option.dataset.id);
            if (part) selectMasterPartForInventory(part);
        }));
    }

    function selectMasterPartForInventory(p) {
        document.getElementById('inv-item-master-select').value = p.id;
        document.getElementById('inv-item-master-search').value = `${p.part_name}${p.part_code ? ` (${p.part_code})` : ''}`;
        document.getElementById('inv-item-price').value = p.unit_price || 0;
        document.getElementById('inv-item-stock').value = p.current_stock || 0;
        document.getElementById('inv-item-min-stock').value = p.min_stock_level ?? 5;
        document.getElementById('inv-item-specs').value = p.specifications || '';
        document.getElementById('inv-item-master-options').classList.remove('show');
    }

    async function openCreateInventoryItemModal() {
        document.getElementById('inv-item-id').value = '';
        document.getElementById('inv-item-master-select').value = '';
        document.getElementById('inv-item-master-search').value = '';
        document.getElementById('inv-item-master-search').disabled = false;
        document.getElementById('inv-item-price').value = '';
        document.getElementById('inv-item-stock').value = '';
        document.getElementById('inv-item-min-stock').value = '5';
        document.getElementById('inv-item-specs').value = '';
        document.getElementById('modal-inv-item-title').innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Add Item to Inventory Stock';
        document.getElementById('btn-submit-inv-item').innerHTML = '<i class="fa-solid fa-plus"></i> Save to Inventory Stock';

        try {
            const res = await API.getParts({ in_inventory: '0' });
            inventoryMasterParts = res.success ? (res.data || []) : [];
        } catch (e) { inventoryMasterParts = []; }

        openModal('modal-inventory-item');
        renderInventoryPartOptions();
    }
    window.openCreateInventoryItemModal = openCreateInventoryItemModal;

    async function openEditInventoryItemModal(id) {
        try {
            const res = await API.getPartById(id);
            if (res.success && res.data) {
                const p = res.data;
                document.getElementById('inv-item-id').value = p.id;
                inventoryMasterParts = [p];
                selectMasterPartForInventory(p);
                document.getElementById('inv-item-master-search').disabled = true;
                document.getElementById('inv-item-price').value = p.unit_price || '0';
                document.getElementById('inv-item-stock').value = p.current_stock || '0';
                document.getElementById('inv-item-min-stock').value = p.min_stock_level || '5';
                document.getElementById('inv-item-specs').value = p.specifications || '';

                document.getElementById('modal-inv-item-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Inventory Item: <strong>${p.part_name}</strong>`;
                document.getElementById('btn-submit-inv-item').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Inventory Item';

                openModal('modal-inventory-item');
            }
        } catch (e) {
            showToast('Failed to load item details', 'error');
        }
    }
    window.openEditInventoryItemModal = openEditInventoryItemModal;

    window.handleInventoryItemSubmit = async function(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('inv-item-id').value;
        const part_id = document.getElementById('inv-item-master-select').value;
        const unit_price = parseFloat(document.getElementById('inv-item-price').value) || 0;
        const current_stock = parseFloat(document.getElementById('inv-item-stock').value) || 0;
        const parsedMinStock = parseFloat(document.getElementById('inv-item-min-stock').value);
        const min_stock_level = Number.isNaN(parsedMinStock) ? 5 : parsedMinStock;
        const note = document.getElementById('inv-item-specs').value.trim();

        if (!part_id) {
            showToast('Please select an item from Master Parts', 'error');
            return;
        }

        const data = { part_id, unit_price, current_stock, min_stock_level, note };

        const submitBtn = document.getElementById('btn-submit-inv-item');
        if (submitBtn) submitBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await API.updateInventoryDetails(id, data);
            } else {
                res = await API.addToInventory(data);
            }
            if (submitBtn) submitBtn.disabled = false;

            if (res.success) {
                showToast(res.message || 'Inventory item saved successfully', 'success');
                closeModal('modal-inventory-item');
                loadInventoryData();
                loadStats();
            } else {
                showToast(res.message || 'Failed to save inventory item', 'error');
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            showToast('Server error saving inventory item', 'error');
        }
    };

    window.confirmRemoveFromInventory = async function(id, name) {
        if (confirm(`Remove "${name}" from physical inventory tracking? (Master part specs will remain saved in catalog)`)) {
            try {
                const res = await API.removeFromInventory(id);
                if (res.success) {
                    showToast(res.message || 'Removed from inventory', 'success');
                    loadInventoryData();
                    loadStats();
                } else {
                    showToast(res.message || 'Failed to remove from inventory', 'error');
                }
            } catch (e) {
                showToast('Server error removing from inventory', 'error');
            }
        }
    };

    // Bind Add Inventory Item Button in Toolbar
    document.getElementById('btn-stock-adjust')?.addEventListener('click', openCreateInventoryItemModal);
    document.getElementById('inv-item-master-search')?.addEventListener('input', (e) => {
        document.getElementById('inv-item-master-select').value = '';
        renderInventoryPartOptions(e.target.value);
    });
    document.getElementById('inv-item-master-search')?.addEventListener('focus', (e) => {
        if (!e.target.disabled) renderInventoryPartOptions(e.target.value);
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select')) {
            document.getElementById('inv-item-master-options')?.classList.remove('show');
        }
    });

    function populatePartSelectForTx(parts) {
        const select = document.getElementById('tx-part-id');
        select.innerHTML = '<option value="">Select Part...</option>';
        parts.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.part_code} - ${p.part_name} (Current: ${p.current_stock} ${p.unit_of_measure})</option>`;
        });
    }

    // 4. Load Global Transactions Log
    async function loadTransactionsData() {
        const search = document.getElementById('tx-search').value;
        const type = document.getElementById('tx-filter-type').value;

        const params = {};
        if (search) params.search = search;
        if (type && type !== 'all') params.type = type;

        try {
            const res = await API.getTransactions(params);
            if (res.success) {
                renderTransactionsTable(res.data);
            }
        } catch (err) {
            console.error('Failed to load transactions:', err);
        }
    }

    function renderTransactionsTable(transactions) {
        const tbody = document.getElementById('tx-table-body');
        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        No transactions recorded yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = transactions.map(t => {
            const typeBadge = t.type === 'IN'
                ? `<span class="badge badge-success"><i class="fa-solid fa-arrow-down"></i> Stock IN</span>`
                : `<span class="badge badge-danger"><i class="fa-solid fa-arrow-up"></i> Stock OUT</span>`;

            const dt = new Date(t.created_at).toLocaleString();

            return `
                <tr>
                    <td><small>${dt}</small></td>
                    <td>
                        <strong>${t.part_code}</strong><br>
                        <small class="text-muted">${t.part_name}</small>
                    </td>
                    <td>${typeBadge}</td>
                    <td class="text-right"><strong>${t.quantity}</strong> ${t.unit_of_measure}</td>
                    <td class="text-right">${t.previous_stock}</td>
                    <td class="text-right"><strong>${t.new_stock}</strong></td>
                    <td><code>${t.reference_number || '-'}</code></td>
                    <td>
                        <span class="part-title" style="font-size:0.85rem;">${t.reason}</span>
                        <small class="text-muted">${t.notes || ''}</small>
                    </td>
                    <td><small><i class="fa-solid fa-user"></i> ${t.created_by}</small></td>
                </tr>
            `;
        }).join('');
    }

    // =========================================================================
    // PHASE 2: VENDOR MANAGEMENT MODULE
    // =========================================================================
    async function loadVendorsData() {
        const search = document.getElementById('vendor-search').value;
        const params = {};
        if (search) params.search = search;

        try {
            const res = await API.getVendors(params);
            if (res.success) {
                vendorsList = res.data;
                document.getElementById('sidebar-vendors-count').innerText = vendorsList.length;
                renderVendorsTable(vendorsList);
                populateVendorDropdowns(vendorsList);
            }
        } catch (err) {
            console.error('Failed to load vendors:', err);
        }
    }

    function renderVendorsTable(vendors) {
        const tbody = document.getElementById('vendor-table-body');
        if (vendors.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-handshake-slash fa-2x"></i>
                        <p class="mt-2">No vendor profiles found.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = vendors.map(v => {
            return `
                <tr>
                    <td>
                        <strong style="font-size:0.95rem; color:var(--text-main);">${v.company_name}</strong><br>
                        <small class="text-muted"><i class="fa-solid fa-location-dot"></i> ${v.address || 'N/A'}</small>
                    </td>
                    <td>
                        <span class="part-title">${v.contact_person || 'N/A'}</span>
                        <small class="text-muted">${v.phone ? '<i class="fa-solid fa-phone"></i> ' + v.phone : ''} ${v.email ? ' | ' + v.email : ''}</small>
                    </td>
                    <td><code>${v.gstin || 'N/A'}</code></td>
                    <td><span class="badge badge-outline">${v.payment_terms || '30 Days'}</span></td>
                    <td class="text-center"><span class="badge badge-primary">${v.total_bills} Bills</span></td>
                    <td class="text-right"><strong>₹${v.total_spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    <td class="text-right">
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                            ${hasPermission('vendors', 'edit') ? `<button class="btn btn-icon btn-sm btn-edit-vendor" data-id="${v.id}" title="Edit Vendor Profile">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>` : ''}
                            ${hasPermission('vendors', 'delete') ? `<button class="btn btn-icon btn-sm btn-delete-vendor" data-id="${v.id}" title="Delete Vendor">
                                <i class="fa-solid fa-trash-can text-danger"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-edit-vendor').forEach(btn => {
            btn.addEventListener('click', () => {
                const vendorId = btn.getAttribute('data-id');
                openEditVendorModal(vendorId);
            });
        });

        document.querySelectorAll('.btn-delete-vendor').forEach(btn => {
            btn.addEventListener('click', () => {
                const vendorId = btn.getAttribute('data-id');
                confirmDeleteVendor(vendorId);
            });
        });
    }

    function populateVendorDropdowns(vendors) {
        const billFilter = document.getElementById('bill-vendor-filter');
        const billVendorSelect = document.getElementById('bill-vendor-id');

        const currentFilterVal = billFilter ? billFilter.value : 'all';
        const currentBillVendorVal = billVendorSelect ? billVendorSelect.value : '';

        if (billFilter) {
            billFilter.innerHTML = '<option value="all">All Vendors</option>';
            if (vendors && vendors.length > 0) {
                vendors.forEach(v => {
                    const isSel = v.id == currentFilterVal ? 'selected' : '';
                    billFilter.innerHTML += `<option value="${v.id}" ${isSel}>${v.company_name}</option>`;
                });
            }
        }

        if (billVendorSelect) {
            if (!vendors || vendors.length === 0) {
                billVendorSelect.innerHTML = '<option value="">No vendors found (Add in Vendors tab first)</option>';
            } else {
                billVendorSelect.innerHTML = '<option value="">Select Vendor...</option>';
                vendors.forEach(v => {
                    const isSel = v.id == currentBillVendorVal ? 'selected' : '';
                    billVendorSelect.innerHTML += `<option value="${v.id}" ${isSel}>${v.company_name} (${v.gstin || 'No GSTIN'})</option>`;
                });
            }
        }
    }

    // Add Vendor Modal Handler
    document.getElementById('btn-add-vendor').addEventListener('click', () => {
        document.getElementById('form-vendor').reset();
        document.getElementById('vendor-id').value = '';
        document.getElementById('modal-vendor-title').innerHTML = '<i class="fa-solid fa-handshake"></i> Add Vendor Profile';
        openModal('modal-vendor');
    });

    async function openEditVendorModal(id) {
        try {
            const res = await API.getVendorById(id);
            if (res.success) {
                const v = res.data;
                document.getElementById('vendor-id').value = v.id;
                document.getElementById('vendor-company').value = v.company_name;
                document.getElementById('vendor-contact').value = v.contact_person;
                document.getElementById('vendor-phone').value = v.phone;
                document.getElementById('vendor-email').value = v.email;
                document.getElementById('vendor-gstin').value = v.gstin;
                document.getElementById('vendor-payment-terms').value = v.payment_terms;
                document.getElementById('vendor-address').value = v.address;

                document.getElementById('modal-vendor-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Vendor (${v.company_name})`;
                openModal('modal-vendor');
            }
        } catch (err) {
            showToast('Failed to fetch vendor details', 'error');
        }
    }

    document.getElementById('form-vendor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('vendor-id').value;

        const vendorData = {
            company_name: document.getElementById('vendor-company').value,
            contact_person: document.getElementById('vendor-contact').value,
            phone: document.getElementById('vendor-phone').value,
            email: document.getElementById('vendor-email').value,
            gstin: document.getElementById('vendor-gstin').value,
            payment_terms: document.getElementById('vendor-payment-terms').value,
            address: document.getElementById('vendor-address').value
        };

        try {
            let res;
            if (id) {
                res = await API.updateVendor(id, vendorData);
            } else {
                res = await API.createVendor(vendorData);
            }

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('modal-vendor');
                loadVendorsData();
            } else {
                showToast(res.message || 'Operation failed', 'error');
            }
        } catch (err) {
            showToast('Server error processing vendor form', 'error');
        }
    });

    async function confirmDeleteVendor(id) {
        if (confirm('Are you sure you want to delete this vendor profile?')) {
            try {
                const res = await API.deleteVendor(id);
                if (res.success) {
                    showToast(res.message, 'success');
                    loadVendorsData();
                } else {
                    showToast(res.message, 'error');
                }
            } catch (err) {
                showToast('Failed to delete vendor', 'error');
            }
        }
    }

    document.getElementById('vendor-search').addEventListener('input', debounce(() => loadVendorsData(), 300));
    document.getElementById('btn-refresh-vendors').addEventListener('click', () => loadVendorsData());

    // =========================================================================
    // PHASE 2: MULTI-VENDOR PURCHASE & BILLING MODULE
    // =========================================================================
    async function loadPurchaseBillsData() {
        const search = document.getElementById('bill-search').value;
        const vendor_id = document.getElementById('bill-vendor-filter').value;

        const params = {};
        if (search) params.search = search;
        if (vendor_id && vendor_id !== 'all') params.vendor_id = vendor_id;

        try {
            // Preload latest vendors and parts
            const [vRes, pRes, billsRes] = await Promise.all([
                API.getVendors(),
                API.getParts(),
                API.getPurchaseBills(params)
            ]);

            if (vRes.success) {
                vendorsList = vRes.data;
                populateVendorDropdowns(vendorsList);
            }

            if (pRes.success) {
                partsList = pRes.data;
            }

            if (billsRes.success) {
                const bills = billsRes.data;
                const sidebarBills = document.getElementById('sidebar-bills-count');
                if (sidebarBills) sidebarBills.innerText = bills.length;
                renderBillsTable(bills);
            }
        } catch (err) {
            console.error('Failed to load purchase bills:', err);
        }
    }

    function renderBillsTable(bills) {
        const tbody = document.getElementById('bill-table-body');
        if (bills.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-file-invoice fa-2x"></i>
                        <p class="mt-2">No purchase bills created yet.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = bills.map(b => {
            return `
                <tr>
                    <td><strong><code>${b.bill_number}</code></strong></td>
                    <td><small>${b.bill_date}</small></td>
                    <td>
                        <span class="part-title">${b.vendor_name}</span>
                        <small class="text-muted">${b.vendor_gstin ? 'GSTIN: ' + b.vendor_gstin : 'No GSTIN'}</small>
                    </td>
                    <td class="text-center"><span class="badge badge-outline">${b.item_count} Parts</span></td>
                    <td class="text-right">₹${parseFloat(b.subtotal).toFixed(2)}</td>
                    <td class="text-right"><small class="text-muted">₹${parseFloat(b.tax_amount).toFixed(2)} (${b.tax_rate}%)</small></td>
                    <td class="text-right"><strong style="font-size:1.05rem; color:var(--success);">₹${parseFloat(b.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    <td><span class="badge badge-success"><i class="fa-solid fa-check"></i> COMPLETED</span></td>
                    <td class="text-right">
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                            <a href="/api/purchase-bills/${b.id}/pdf" target="_blank" class="btn btn-secondary btn-sm" title="Print / Download PDF Invoice">
                                <i class="fa-solid fa-file-pdf"></i> PDF Invoice
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Dynamic Line Items Adder for Create Purchase Bill Modal
    const billItemsBody = document.getElementById('bill-items-body');

    function addBillItemRow(selectedPartId = '', qty = 1, price = 0) {
        const tr = document.createElement('tr');
        tr.className = 'bill-item-row';

        let partOptions = `<option value="">Select Part...</option>`;
        if (!partsList || partsList.length === 0) {
            partOptions = `<option value="">No parts found (Add in Master Parts first)</option>`;
        } else {
            partsList.forEach(p => {
                const isSel = p.id == selectedPartId ? 'selected' : '';
                partOptions += `<option value="${p.id}" data-price="${p.unit_price || 0}" ${isSel}>${p.part_code} - ${p.part_name} (₹${p.unit_price || 0})</option>`;
            });
        }

        tr.innerHTML = `
            <td>
                <select class="form-control bill-item-part" required>
                    ${partOptions}
                </select>
            </td>
            <td>
                <input type="number" step="0.01" min="0.01" class="form-control text-right bill-item-qty" value="${qty}" required>
            </td>
            <td>
                <input type="number" step="0.01" min="0" class="form-control text-right bill-item-price" value="${price}" required>
            </td>
            <td class="text-right">
                <strong class="bill-item-total">₹0.00</strong>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-icon btn-sm btn-remove-item" title="Remove Line Item">
                    <i class="fa-solid fa-xmark text-danger"></i>
                </button>
            </td>
        `;

        billItemsBody.appendChild(tr);

        // Attach change listeners for live calculations
        const partSelect = tr.querySelector('.bill-item-part');
        const qtyInput = tr.querySelector('.bill-item-qty');
        const priceInput = tr.querySelector('.bill-item-price');
        const removeBtn = tr.querySelector('.btn-remove-item');

        partSelect.addEventListener('change', () => {
            const opt = partSelect.options[partSelect.selectedIndex];
            const defaultPrice = opt.getAttribute('data-price');
            if (defaultPrice && (!priceInput.value || parseFloat(priceInput.value) === 0)) {
                priceInput.value = parseFloat(defaultPrice).toFixed(2);
            }
            calculateBillTotals();
        });

        qtyInput.addEventListener('input', calculateBillTotals);
        priceInput.addEventListener('input', calculateBillTotals);

        removeBtn.addEventListener('click', () => {
            tr.remove();
            calculateBillTotals();
        });

        calculateBillTotals();
    }

    function calculateBillTotals() {
        let subtotal = 0.0;
        document.querySelectorAll('.bill-item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.bill-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.bill-item-price').value) || 0;
            const lineTotal = qty * price;
            row.querySelector('.bill-item-total').innerText = `₹${lineTotal.toFixed(2)}`;
            subtotal += lineTotal;
        });

        document.getElementById('bill-subtotal').value = subtotal.toFixed(2);

        const taxRate = parseFloat(document.getElementById('bill-tax-rate').value) || 0;
        const discount = parseFloat(document.getElementById('bill-discount').value) || 0;
        const freight = parseFloat(document.getElementById('bill-freight').value) || 0;

        const taxAmount = (subtotal - discount) * (taxRate / 100.0);
        const grandTotal = (subtotal - discount) + taxAmount + freight;

        document.getElementById('bill-grand-total').value = `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    document.getElementById('bill-tax-rate').addEventListener('input', calculateBillTotals);
    document.getElementById('bill-discount').addEventListener('input', calculateBillTotals);
    document.getElementById('bill-freight').addEventListener('input', calculateBillTotals);

    document.getElementById('btn-add-bill-item').addEventListener('click', () => {
        addBillItemRow();
    });

    document.getElementById('btn-create-bill').addEventListener('click', async () => {
        // Fetch freshest vendors and parts before opening
        try {
            const [vRes, pRes] = await Promise.all([
                API.getVendors(),
                API.getParts()
            ]);
            if (vRes.success) {
                vendorsList = vRes.data;
                populateVendorDropdowns(vendorsList);
            }
            if (pRes.success) {
                partsList = pRes.data;
            }
        } catch (e) {
            console.error('Error fetching vendors/parts for bill:', e);
        }

        document.getElementById('form-purchase-bill').reset();
        document.getElementById('bill-date').value = new Date().toISOString().split('T')[0];
        billItemsBody.innerHTML = '';
        addBillItemRow(); // Add 1 initial row
        openModal('modal-purchase-bill');
    });

    document.getElementById('form-purchase-bill').addEventListener('submit', async (e) => {
        e.preventDefault();

        const vendor_id = document.getElementById('bill-vendor-id').value;
        const bill_number = document.getElementById('bill-number-input').value;
        const bill_date = document.getElementById('bill-date').value;
        const due_date = document.getElementById('bill-due-date').value;
        const tax_rate = document.getElementById('bill-tax-rate').value;
        const discount = document.getElementById('bill-discount').value;
        const additional_charges = document.getElementById('bill-freight').value;
        const notes = document.getElementById('bill-notes').value;

        const items = [];
        document.querySelectorAll('.bill-item-row').forEach(row => {
            const part_id = row.querySelector('.bill-item-part').value;
            const quantity = row.querySelector('.bill-item-qty').value;
            const unit_price = row.querySelector('.bill-item-price').value;
            if (part_id && parseFloat(quantity) > 0) {
                items.push({ part_id, quantity, unit_price });
            }
        });

        if (items.length === 0) {
            showToast('Please add at least one line item to the bill', 'error');
            return;
        }

        const billData = {
            vendor_id,
            bill_number,
            bill_date,
            due_date,
            tax_rate,
            discount,
            additional_charges,
            notes,
            items
        };

        try {
            const res = await API.createPurchaseBill(billData);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('modal-purchase-bill');
                loadPurchaseBillsData();
                loadInventoryData(); // Refresh stock IN balance
            } else {
                showToast(res.message || 'Failed to create purchase bill', 'error');
            }
        } catch (err) {
            showToast('Server error processing purchase bill', 'error');
        }
    });

    document.getElementById('bill-search').addEventListener('input', debounce(() => loadPurchaseBillsData(), 300));
    document.getElementById('bill-vendor-filter').addEventListener('change', () => loadPurchaseBillsData());
    document.getElementById('btn-refresh-bills').addEventListener('click', () => loadPurchaseBillsData());

    // 5. Search & Filter Handlers
    document.getElementById('inventory-search').addEventListener('input', debounce(() => loadInventoryData(), 300));
    document.getElementById('filter-category').addEventListener('change', () => loadInventoryData());
    document.getElementById('btn-refresh-inventory').addEventListener('click', () => loadInventoryData());

    document.getElementById('filter-low-stock-toggle').addEventListener('click', (e) => {
        isLowStockFilterActive = !isLowStockFilterActive;
        const btn = e.currentTarget;
        if (isLowStockFilterActive) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Showing Low Stock';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-filter"></i> Low Stock Only';
        }
        loadInventoryData();
    });

    document.getElementById('kpi-low-stock-card').addEventListener('click', () => {
        isLowStockFilterActive = true;
        const btn = document.getElementById('filter-low-stock-toggle');
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Showing Low Stock';
        switchTab('inventory');
    });

    document.getElementById('tx-search').addEventListener('input', debounce(() => loadTransactionsData(), 300));
    document.getElementById('tx-filter-type').addEventListener('change', () => loadTransactionsData());
    document.getElementById('btn-refresh-tx').addEventListener('click', () => loadTransactionsData());

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // 6. Master Part Modal Management (Create / Edit)
    async function openCreatePartModal() {
        document.getElementById('form-part').reset();
        document.getElementById('part-id').value = '';
        document.getElementById('part-code').value = '';
        document.getElementById('modal-part-title').innerHTML = `<i class="fa-solid fa-shapes"></i> Create Master Part`;
        document.getElementById('btn-modal-submit-part').innerHTML = `<i class="fa-solid fa-plus"></i> Create Master Part`;
        
        if (!categoriesList || categoriesList.length === 0) {
            await loadCategories();
        } else {
            populateCategorySelects();
        }
        
        openModal('modal-part');
    }
    window.openCreatePartModal = openCreatePartModal;

    document.getElementById('btn-add-part')?.addEventListener('click', openCreatePartModal);
    document.getElementById('btn-open-create-master-part')?.addEventListener('click', openCreatePartModal);
    document.getElementById('btn-planner-create-part')?.addEventListener('click', openCreatePartModal);
    document.getElementById('btn-quick-cat-part-modal')?.addEventListener('click', () => {
        document.getElementById('form-category').reset();
        openModal('modal-category');
    });

    // Master Parts Page Search & Filter
    document.getElementById('master-parts-search')?.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const cat = document.getElementById('master-parts-filter-category')?.value || 'all';
        loadMasterPartsData(query, cat);
    });

    document.getElementById('master-parts-filter-category')?.addEventListener('change', (e) => {
        const cat = e.target.value;
        const query = document.getElementById('master-parts-search')?.value.trim() || '';
        loadMasterPartsData(query, cat);
    });

    document.getElementById('btn-refresh-master-parts')?.addEventListener('click', () => {
        const query = document.getElementById('master-parts-search')?.value.trim() || '';
        const cat = document.getElementById('master-parts-filter-category')?.value || 'all';
        loadMasterPartsData(query, cat);
    });

    // Links between Planner & Master Parts
    document.getElementById('btn-goto-master-parts')?.addEventListener('click', () => switchTab('master-parts'));
    document.getElementById('link-goto-master-parts')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('master-parts');
    });

    async function openEditPartModal(id) {
        try {
            if (!categoriesList || categoriesList.length === 0) {
                await loadCategories();
            } else {
                populateCategorySelects();
            }

            const res = await API.getPartById(id);
            if (res.success) {
                const p = res.data;
                document.getElementById('part-id').value = p.id;
                document.getElementById('part-code').value = p.part_code || '';
                document.getElementById('part-name').value = p.part_name;
                document.getElementById('part-category').value = p.category_id;
                document.getElementById('drawing-number').value = p.drawing_number || '';
                document.getElementById('material-grade').value = p.material_grade || '';
                document.getElementById('diameter').value = p.diameter || '';
                document.getElementById('length').value = p.length || '';

                document.getElementById('modal-part-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Master Part (${p.part_name})`;
                document.getElementById('btn-modal-submit-part').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Master Part`;
                openModal('modal-part');
            }
        } catch (err) {
            showToast('Failed to fetch part details for editing', 'error');
        }
    }
    window.openEditPartModal = openEditPartModal;

    async function handleMasterPartSubmit(e) {
        if (e) e.preventDefault();

        const id = document.getElementById('part-id').value;
        const partName = document.getElementById('part-name').value.trim();
        const drawingNumber = document.getElementById('drawing-number').value.trim();
        const categoryVal = document.getElementById('part-category').value;
        const categoryId = parseInt(categoryVal);
        const materialGrade = document.getElementById('material-grade').value.trim();
        const diameter = parseFloat(document.getElementById('diameter').value) || 0;
        const length = parseFloat(document.getElementById('length').value) || 0;
        const partCode = document.getElementById('part-code').value || undefined;

        if (!partName) {
            showToast('Part Name is mandatory', 'error');
            document.getElementById('part-name').focus();
            return;
        }

        if (!drawingNumber) {
            showToast('Drawing Number is mandatory', 'error');
            document.getElementById('drawing-number').focus();
            return;
        }

        if (!categoryId || isNaN(categoryId)) {
            showToast('Please select a valid Category', 'error');
            document.getElementById('part-category').focus();
            return;
        }

        const partData = {
            part_code: partCode,
            part_name: partName,
            category_id: categoryId,
            drawing_number: drawingNumber,
            material_grade: materialGrade,
            diameter: diameter,
            length: length,
            unit_of_measure: 'Pcs',
            unit_price: 0,
            current_stock: 0,
            min_stock_level: 5
        };

        const submitBtn = document.getElementById('btn-modal-submit-part');
        if (submitBtn) submitBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await API.updatePart(id, partData);
            } else {
                res = await API.createPart(partData);
            }

            if (submitBtn) submitBtn.disabled = false;

            if (res && res.success) {
                showToast(res.message || 'Master Part saved successfully', 'success');
                closeModal('modal-part');

                // Clear any active filters so the newly saved part is immediately visible.
                const masterSearch = document.getElementById('master-parts-search');
                const masterCategory = document.getElementById('master-parts-filter-category');
                if (masterSearch) masterSearch.value = '';
                if (masterCategory) masterCategory.value = 'all';

                await loadMasterPartsData('', 'all');
                await loadInventoryData();
                if (typeof loadPlannerParts === 'function') {
                    await loadPlannerParts();
                }
            } else {
                showToast(res?.message || 'Failed to save master part', 'error');
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            console.error('Error submitting master part form:', err);
            showToast('Server error processing master part', 'error');
        }
    }
    window.handleMasterPartSubmit = handleMasterPartSubmit;

    document.getElementById('form-part')?.addEventListener('submit', handleMasterPartSubmit);

    async function confirmDeletePart(id) {
        if (confirm('Are you sure you want to delete this part from the Master Parts Database?')) {
            try {
                const res = await API.deletePart(id);
                if (res.success) {
                    showToast(res.message, 'success');
                    loadMasterPartsData();
                    loadInventoryData();
                    if (typeof loadPlannerParts === 'function') {
                        loadPlannerParts();
                    }
                } else {
                    showToast(res.message || 'Failed to delete part', 'error');
                }
            } catch (err) {
                showToast('Failed to delete part', 'error');
            }
        }
    }
    window.confirmDeletePart = confirmDeletePart;
    window.deleteMasterPart = confirmDeletePart;

    // 7. Stock IN / Stock OUT Form Submission
    document.getElementById('form-stock-tx')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const txData = {
            part_id: document.getElementById('tx-part-id').value,
            type: document.getElementById('tx-type').value,
            quantity: document.getElementById('tx-quantity').value,
            reference_number: document.getElementById('tx-reference').value,
            reason: document.getElementById('tx-reason').value,
            notes: document.getElementById('tx-notes').value,
            created_by: 'Admin'
        };

        try {
            const res = await API.createTransaction(txData);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('modal-stock-tx');
                loadInventoryData();
                if (currentTab === 'transactions') loadTransactionsData();
            } else {
                showToast(res.message || 'Transaction failed', 'error');
            }
        } catch (err) {
            showToast('Server error submitting stock transaction', 'error');
        }
    });

    // 8. Category Management (Add, Edit, Delete)
    function openCreateCategoryModal() {
        document.getElementById('form-category').reset();
        document.getElementById('category-edit-id').value = '';
        document.getElementById('modal-category-title').innerHTML = `<i class="fa-solid fa-folder-plus"></i> Add Category`;
        document.getElementById('btn-cat-submit').innerHTML = `<i class="fa-solid fa-plus"></i> Save Category`;
        openModal('modal-category');
    }
    window.openCreateCategoryModal = openCreateCategoryModal;

    function openEditCategoryModal(id, name, desc) {
        document.getElementById('category-edit-id').value = id;
        document.getElementById('category-name').value = name;
        document.getElementById('category-desc').value = desc || '';
        document.getElementById('modal-category-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Category (${name})`;
        document.getElementById('btn-cat-submit').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Category`;
        openModal('modal-category');
    }
    window.openEditCategoryModal = openEditCategoryModal;

    document.getElementById('btn-open-create-category-page')?.addEventListener('click', openCreateCategoryModal);
    document.getElementById('btn-refresh-categories-page')?.addEventListener('click', () => {
        const query = document.getElementById('categories-page-search')?.value.trim() || '';
        loadCategoriesPageData(query);
    });
    document.getElementById('categories-page-search')?.addEventListener('input', (e) => {
        loadCategoriesPageData(e.target.value.trim());
    });
    document.getElementById('btn-quick-cat-part-modal')?.addEventListener('click', openCreateCategoryModal);
    document.getElementById('btn-quick-cat-mp')?.addEventListener('click', openCreateCategoryModal);

    async function loadCategoriesPageData(search = '') {
        const tbody = document.getElementById('categories-page-table-body');
        if (!tbody) return;

        try {
            const res = await API.getCategories();
            if (res.success) {
                let categories = res.data || [];
                const catBadge = document.getElementById('sidebar-categories-count');
                if (catBadge) catBadge.innerText = categories.length;

                if (search) {
                    const q = search.toLowerCase();
                    categories = categories.filter(c => 
                        (c.name && c.name.toLowerCase().includes(q)) || 
                        (c.description && c.description.toLowerCase().includes(q))
                    );
                }

                if (categories.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No categories found.</td></tr>';
                    return;
                }

                tbody.innerHTML = categories.map(c => {
                    const safeName = (c.name || '').replace(/'/g, "\\'");
                    const safeDesc = (c.description || '').replace(/'/g, "\\'");
                    const countBadge = (c.parts_count > 0)
                        ? `<span class="badge badge-primary">${c.parts_count} parts</span>`
                        : `<span class="badge badge-outline">0 parts</span>`;

                    return `
                        <tr>
                            <td><strong style="color:var(--text-main); font-size:0.95rem;">${c.name}</strong></td>
                            <td><span style="color:var(--text-muted); font-size:0.88rem;">${c.description || '—'}</span></td>
                            <td class="text-center">${countBadge}</td>
                            <td><small class="text-muted">${c.created_at ? c.created_at.split(' ')[0] : '—'}</small></td>
                            <td class="text-right">
                                <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end;">
                                    ${hasPermission('categories', 'edit') ? `<button class="btn btn-outline btn-sm" onclick="openEditCategoryModal(${c.id}, '${safeName}', '${safeDesc}')" title="Edit Category">
                                        <i class="fa-solid fa-pen"></i> Edit
                                    </button>` : ''}
                                    ${hasPermission('categories', 'delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteCategoryItem(${c.id}, '${safeName}')" title="Delete Category">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-danger">Failed to load categories.</td></tr>';
        }
    }

    window.deleteCategoryItem = async function(id, name) {
        if (confirm(`Are you sure you want to delete category "${name}"?`)) {
            try {
                const res = await API.deleteCategory(id);
                if (res.success) {
                    showToast(res.message, 'success');
                    await loadCategories();
                    if (typeof populatePlannerCategories === 'function') {
                        await populatePlannerCategories();
                    }
                    if (typeof loadMasterPartsData === 'function') {
                        loadMasterPartsData();
                    }
                    loadCategoriesPageData();
                } else {
                    showToast(res.message || 'Failed to delete category', 'error');
                }
            } catch (err) {
                showToast('Server error deleting category', 'error');
            }
        }
    };

    document.getElementById('form-category')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('category-edit-id').value;
        const name = document.getElementById('category-name').value.trim();
        const description = document.getElementById('category-desc').value.trim();

        if (!name) {
            showToast('Category name is required', 'error');
            return;
        }

        const catData = { name, description };
        const submitBtn = document.getElementById('btn-cat-submit');
        submitBtn.disabled = true;

        try {
            let res;
            if (editId) {
                res = await API.updateCategory(editId, catData);
            } else {
                res = await API.createCategory(catData);
            }

            submitBtn.disabled = false;

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('modal-category');

                await loadCategories();
                if (typeof populatePlannerCategories === 'function') {
                    await populatePlannerCategories();
                }
                if (typeof loadMasterPartsData === 'function') {
                    await loadMasterPartsData();
                }

                // Clear the category search so the newly saved category is visible.
                const categorySearch = document.getElementById('categories-page-search');
                if (categorySearch) categorySearch.value = '';
                await loadCategoriesPageData('');

                const newCatId = res.data?.id;
                if (newCatId) {
                    const mpCat = document.getElementById('mp-category-id');
                    if (mpCat) mpCat.value = newCatId;
                    const partCat = document.getElementById('part-category');
                    if (partCat) partCat.value = newCatId;
                }
            } else {
                showToast(res.message || 'Failed to save category', 'error');
            }
        } catch (err) {
            submitBtn.disabled = false;
            showToast('Server error saving category', 'error');
        }
    });

    async function openPartHistoryModal(id) {
        try {
            const res = await API.getPartById(id);
            if (res.success) {
                const p = res.data;
                document.getElementById('modal-history-title').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Stock Movement History: <strong>${p.part_name}</strong> (${p.part_code})`;
                
                const tbody = document.getElementById('part-history-table-body');
                if (!p.transactions || p.transactions.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No stock transactions logged for this part yet.</td></tr>`;
                } else {
                    tbody.innerHTML = p.transactions.map(t => {
                        const typeBadge = t.type === 'IN'
                            ? `<span class="badge badge-success"><i class="fa-solid fa-arrow-down"></i> IN</span>`
                            : `<span class="badge badge-danger"><i class="fa-solid fa-arrow-up"></i> OUT</span>`;
                        return `
                            <tr>
                                <td><small>${new Date(t.created_at).toLocaleString()}</small></td>
                                <td>${typeBadge}</td>
                                <td class="text-right"><strong>${t.quantity}</strong> ${p.unit_of_measure}</td>
                                <td class="text-right">${t.previous_stock}</td>
                                <td class="text-right"><strong>${t.new_stock}</strong></td>
                                <td><code>${t.reference_number || '-'}</code></td>
                                <td>
                                    <span class="part-title" style="font-size:0.85rem;">${t.reason}</span>
                                    <small class="text-muted">${t.notes || ''}</small>
                                </td>
                                <td><small>${t.created_by}</small></td>
                            </tr>
                        `;
                    }).join('');
                }
                openModal('modal-part-history');
            }
        } catch (err) {
            showToast('Failed to fetch part stock history', 'error');
        }
    }

    // Ensure KPI grid visible on first load
    document.getElementById('kpi-grid').style.display = 'none';

    // ═══════════════════════════════════════════════════════════════════════
    // MASTER PARTS PAGE LOGIC
    // ═══════════════════════════════════════════════════════════════════════

    let masterPartsList = [];
    let masterPartsRequestId = 0;

    async function loadMasterPartsData(search = '', category_id = 'all') {
        const requestId = ++masterPartsRequestId;
        try {
            const params = {};
            if (search) params.search = search;
            if (category_id && category_id !== 'all') params.category_id = category_id;

            const res = await API.getParts(params);
            // A slower, older search/filter response must not replace newer data.
            if (requestId !== masterPartsRequestId) return;
            if (res && res.success) {
                masterPartsList = res.data || [];
                const badge1 = document.getElementById('sidebar-master-parts-count');
                if (badge1) badge1.innerText = masterPartsList.length;
                const badge2 = document.getElementById('sidebar-parts-count');
                if (badge2) badge2.innerText = masterPartsList.length;
                renderMasterPartsTable(masterPartsList);
            } else {
                renderMasterPartsTable([]);
            }
        } catch (err) {
            if (requestId !== masterPartsRequestId) return;
            console.error('Error loading master parts:', err);
            renderMasterPartsTable([]);
        }
    }

    function renderMasterPartsTable(parts) {
        const tbody = document.getElementById('master-parts-table-body');
        if (!tbody) return;

        if (!parts || parts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        No Master Parts found. Click <strong>Create Master Part</strong> above to add one.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = parts.map(p => {
            const diaText = p.diameter ? `Ø${p.diameter} mm` : '—';
            const lenText = p.length ? `L ${p.length} mm` : '—';
            const dimFormatted = (p.diameter || p.length) ? `<span style="font-weight:600; color:var(--text-main);">${diaText} × ${lenText}</span>` : '<span class="text-muted">—</span>';
            const catBadge = p.category_name ? `<span class="badge badge-outline">${p.category_name}</span>` : '<span class="badge badge-muted">None</span>';

            const invStatusBadge = p.in_inventory 
                ? `<span class="badge badge-success" title="Tracked in physical inventory"><i class="fa-solid fa-boxes-stacked"></i> In Stock (${p.current_stock || 0} ${p.unit_of_measure || 'Pcs'})</span>`
                : `<span class="badge badge-outline" title="Catalog specification only (not added to inventory)"><i class="fa-solid fa-file-lines"></i> Catalog Only</span>`;

            return `
                <tr>
                    <td>
                        <strong style="color:var(--text-main); font-size:0.95rem;">${p.part_name}</strong>
                    </td>
                    <td><strong style="color:#2563eb; font-size:0.92rem;">${p.drawing_number || '—'}</strong></td>
                    <td>${catBadge}</td>
                    <td><strong>${p.material_grade || '—'}</strong></td>
                    <td>${dimFormatted}</td>
                    <td class="text-center">${invStatusBadge}</td>
                    <td class="text-right">
                        <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end; align-items:center;">
                            ${(!p.in_inventory && hasPermission('inventory', 'create')) ? `<button class="btn btn-outline btn-sm" onclick="openEditInventoryItemModal(${p.id})" title="Add to Physical Inventory Stock">
                                <i class="fa-solid fa-plus text-primary"></i> Add to Stock
                            </button>` : ''}
                            ${hasPermission('master_parts', 'edit') ? `<button class="btn btn-outline btn-sm" onclick="openEditPartModal(${p.id})" title="Edit Master Part">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>` : ''}
                            ${hasPermission('master_parts', 'delete') ? `<button class="btn btn-danger btn-sm" onclick="confirmDeletePart(${p.id})" title="Delete Master Part">
                                <i class="fa-solid fa-trash"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openCreatePartModal() {
        document.getElementById('form-part')?.reset();
        document.getElementById('part-id').value = '';
        document.getElementById('modal-part-title').innerHTML = '<i class="fa-solid fa-shapes"></i> Create Master Part';
        document.getElementById('btn-modal-submit-part').innerHTML = '<i class="fa-solid fa-plus"></i> Create Master Part';
        
        const catSelect = document.getElementById('part-category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select Category...</option>' + 
                categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        openModal('modal-part');
    }
    window.openCreatePartModal = openCreatePartModal;

    async function openEditPartModal(id) {
        try {
            const res = await API.getPartById(id);
            if (res.success && res.data) {
                const p = res.data;
                document.getElementById('part-id').value = p.id;
                document.getElementById('part-name').value = p.part_name || '';
                document.getElementById('drawing-number').value = p.drawing_number || '';
                document.getElementById('material-grade').value = p.material_grade || '';
                document.getElementById('diameter').value = p.diameter || '';
                document.getElementById('length').value = p.length || '';

                const catSelect = document.getElementById('part-category');
                if (catSelect) {
                    catSelect.innerHTML = '<option value="">Select Category...</option>' + 
                        categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    catSelect.value = p.category_id || '';
                }

                document.getElementById('modal-part-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Master Part: <strong>${p.part_name}</strong>`;
                document.getElementById('btn-modal-submit-part').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Master Part';

                openModal('modal-part');
            }
        } catch (e) {
            showToast('Failed to load master part details', 'error');
        }
    }
    window.openEditPartModal = openEditPartModal;

    window.confirmDeletePart = async function(id) {
        if (confirm('Are you sure you want to delete this master part?')) {
            try {
                const res = await API.deletePart(id);
                if (res.success) {
                    showToast(res.message || 'Part deleted successfully', 'success');
                    loadMasterPartsData();
                    loadInventoryData();
                    loadPlannerParts();
                    loadStats();
                } else {
                    showToast(res.message || 'Failed to delete part', 'error');
                }
            } catch (e) {
                showToast('Server error deleting part', 'error');
            }
        }
    };

    document.getElementById('btn-refresh-master-parts')?.addEventListener('click', () => {
        const search = document.getElementById('master-parts-search')?.value.trim() || '';
        const cat = document.getElementById('master-parts-filter-category')?.value || 'all';
        loadMasterPartsData(search, cat);
    });

    document.getElementById('master-parts-search')?.addEventListener('input', (e) => {
        const cat = document.getElementById('master-parts-filter-category')?.value || 'all';
        loadMasterPartsData(e.target.value.trim(), cat);
    });

    document.getElementById('master-parts-filter-category')?.addEventListener('change', (e) => {
        const search = document.getElementById('master-parts-search')?.value.trim() || '';
        loadMasterPartsData(search, e.target.value);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // MATERIAL PLANNER & PURCHASING CALCULATOR LOGIC
    // ═══════════════════════════════════════════════════════════════════════

    let plannerPartsList = [];
    let calcItems = [];

    // Load Material Planner initial data
    async function loadMaterialPlannerData() {
        await populatePlannerCategories();
        await loadPlannerParts();
        await loadPlannerHistory();
        renderConsolidatedList();
        renderBreakdownTable();
    }

    async function loadPlannerHistory() {
        const tbody = document.getElementById('planner-history-body');
        if (!tbody) return;
        try {
            const res = await API.getPlannerHistory();
            const rows = res.success ? (res.data || []) : [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No saved calculations yet.</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(row => {
                const created = new Date(String(row.created_at).replace(' ', 'T') + 'Z');
                const dateText = created.toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                const totalFeet = (Number(row.total_length_mm) || 0) / 304.8;
                return `<tr>
                    <td><strong>${dateText}</strong></td>
                    <td><strong>${row.part_name}</strong><br><span class="text-muted">${row.drawing_number ? `Dwg: ${row.drawing_number}` : (row.part_code || '')}</span></td>
                    <td>${row.material_grade || '—'} · Ø${row.diameter || 0} × L${row.length || 0} mm</td>
                    <td class="text-center"><strong>${row.target_quantity}</strong></td>
                    <td>${totalFeet.toFixed(2)} Feet</td>
                    <td>${Number(row.estimated_weight_kg || 0).toFixed(2)} Kg</td>
                    <td><strong>${row.created_by}</strong><br><span class="text-muted">@${row.created_by_username}</span></td>
                </tr>`;
            }).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load calculation history.</td></tr>';
        }
    }

    // Populate Category Dropdowns for Master Part Form & Purchasing Calculator Filter
    async function populatePlannerCategories() {
        try {
            const res = await API.getCategories();
            if (res.success) {
                const categories = res.data || [];
                
                // Filter Select in Inventory tab
                const filterSelect = document.getElementById('filter-category');
                filterSelect.innerHTML = '<option value="all">All Categories</option>';

                // Filter Select in Master Parts tab
                const mpFilterSelect = document.getElementById('master-parts-filter-category');
                if (mpFilterSelect) {
                    mpFilterSelect.innerHTML = '<option value="all">All Categories</option>';
                }

                // Modal Part Category Select
                const modalSelect = document.getElementById('part-category');
                modalSelect.innerHTML = '<option value="">Select Category...</option>';

                categories.forEach(cat => {
                    filterSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
                    if (mpFilterSelect) {
                        mpFilterSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
                    }
                    modalSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
                });
                
                // Form Category Select
                const mpSelect = document.getElementById('mp-category-id');
                if (mpSelect) {
                    const currentVal = mpSelect.value;
                    mpSelect.innerHTML = '<option value="">Select Category...</option>';
                    categories.forEach(c => {
                        mpSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                    });
                    if (currentVal) mpSelect.value = currentVal;
                }

                // Calculator Filter Select
                const calcFilter = document.getElementById('calc-category-filter');
                if (calcFilter) {
                    const currentFilter = calcFilter.value || 'all';
                    calcFilter.innerHTML = '<option value="all">All Categories</option>';
                    categories.forEach(c => {
                        calcFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                    });
                    calcFilter.value = currentFilter;
                }
            }
        } catch (err) {
            console.error('Error populating planner categories:', err);
        }
    }

    // Load Parts for Calculator Select Dropdown
    async function loadPlannerParts(selectedCategoryId = 'all') {
        try {
            const params = { limit: 500 };
            if (selectedCategoryId && selectedCategoryId !== 'all') {
                params.category_id = selectedCategoryId;
            }

            const res = await API.getParts(params);
            const partSelect = document.getElementById('calc-part-select');
            
            if (res.success) {
                plannerPartsList = res.data || [];
                document.getElementById('sidebar-planner-count').innerText = plannerPartsList.length;

                if (partSelect) {
                    partSelect.innerHTML = '<option value="">Select Saved Part...</option>';
                    if (plannerPartsList.length === 0) {
                        partSelect.innerHTML = '<option value="">No parts found in this category</option>';
                    } else {
                        plannerPartsList.forEach(p => {
                            const dwg = p.drawing_number ? p.drawing_number : (p.part_code || '');
                            const grade = p.material_grade || 'Material';
                            const dia = p.diameter ? `Ø${p.diameter}mm` : '';
                            const label = `${p.part_name} (${dwg}) - ${grade} ${dia}`.trim();
                            partSelect.innerHTML += `<option value="${p.id}">${label}</option>`;
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error loading parts for calculator:', err);
        }
    }

    // Filter by Category in Purchasing Calculator
    document.getElementById('calc-category-filter')?.addEventListener('change', (e) => {
        const catId = e.target.value;
        loadPlannerParts(catId);
    });

    // Save Master Part directly from Material Planner
    document.getElementById('planner-part-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const partName = document.getElementById('mp-part-name').value.trim();
        const drawingNo = document.getElementById('mp-drawing-no').value.trim();
        const categoryId = document.getElementById('mp-category-id').value;
        const materialGrade = document.getElementById('mp-material-grade').value.trim();
        const diameter = parseFloat(document.getElementById('mp-diameter').value) || 0;
        const length = parseFloat(document.getElementById('mp-length').value) || 0;

        if (!partName) {
            showToast('Part Name is required', 'error');
            return;
        }
        if (!drawingNo) {
            showToast('Drawing Number is required', 'error');
            return;
        }
        if (!categoryId) {
            showToast('Please select a category', 'error');
            return;
        }

        const payload = {
            part_name: partName,
            drawing_number: drawingNo,
            category_id: parseInt(categoryId),
            material_grade: materialGrade,
            diameter: diameter,
            length: length,
            unit_of_measure: 'Pcs',
            unit_price: 0,
            current_stock: 0,
            min_stock_level: 5
        };

        const btn = document.getElementById('btn-save-master-part');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await API.createPart(payload);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save into Database';

            if (res.success) {
                showToast(`Master part "${partName}" saved successfully!`, 'success');
                document.getElementById('planner-part-form').reset();
                
                // Refresh parts list and categories
                await populatePlannerCategories();
                const currentFilter = document.getElementById('calc-category-filter')?.value || 'all';
                await loadPlannerParts(currentFilter);

                // Auto-select newly saved part in calculator
                const newPartId = res.data?.id;
                if (newPartId) {
                    const partSelect = document.getElementById('calc-part-select');
                    if (partSelect) {
                        partSelect.value = newPartId;
                    }
                }
            } else {
                showToast(res.message || 'Failed to save master part', 'error');
            }
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save into Database';
            showToast('Server error saving master part', 'error');
        }
    });

    // Add Part to Calculation
    document.getElementById('btn-add-to-calc')?.addEventListener('click', async () => {
        const partSelect = document.getElementById('calc-part-select');
        const qtyInput = document.getElementById('calc-target-qty');

        const partId = parseInt(partSelect?.value);
        const qty = parseInt(qtyInput?.value);

        if (!partId) {
            showToast('Please select a saved part from the dropdown', 'error');
            partSelect?.focus();
            return;
        }

        if (!qty || qty <= 0) {
            showToast('Please enter a valid target quantity', 'error');
            qtyInput?.focus();
            return;
        }

        const partObj = plannerPartsList.find(p => p.id === partId);
        if (!partObj) {
            showToast('Selected part could not be found', 'error');
            return;
        }

        const addButton = document.getElementById('btn-add-to-calc');
        addButton.disabled = true;
        const originalButtonHtml = addButton.innerHTML;
        addButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        let saveResult;
        try {
            saveResult = await API.createPlannerCalculation({ part_id: partId, target_quantity: qty });
        } catch (error) {
            saveResult = { success: false, message: 'Server error saving calculation' };
        } finally {
            addButton.disabled = false;
            addButton.innerHTML = originalButtonHtml;
        }
        if (!saveResult.success) {
            showToast(saveResult.message || 'Calculation could not be saved', 'error');
            return;
        }

        // Add to the current view after the permanent audit record is saved.
        calcItems.push({
            part: partObj,
            target_qty: qty
        });

        // Re-render calculation results
        renderConsolidatedList();
        renderBreakdownTable();
        await loadPlannerHistory();

        showToast(`Added ${qty} pcs of "${partObj.part_name}" to calculation`, 'success');

        // Reset quantity input
        qtyInput.value = '';
    });

    // Clear Calculation
    document.getElementById('btn-clear-calc')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (calcItems.length === 0) return;
        
        calcItems = [];
        renderConsolidatedList();
        renderBreakdownTable();
        showToast('Calculation cleared', 'info');
    });

    // Remove single item from calculation
    window.removeCalcItem = function(index) {
        if (index >= 0 && index < calcItems.length) {
            const removed = calcItems.splice(index, 1);
            renderConsolidatedList();
            renderBreakdownTable();
            showToast(`Removed "${removed[0]?.part?.part_name}" from calculation`, 'info');
        }
    };

    // Render Consolidated Purchasing List (Exact Match to Image 2 Top)
    function renderConsolidatedList() {
        const container = document.getElementById('consolidated-body');
        if (!container) return;

        if (calcItems.length === 0) {
            container.innerHTML = `
                <div class="calc-empty-placeholder">
                    <i class="fa-solid fa-calculator fa-2x" style="opacity: 0.3; margin-bottom: 0.5rem;"></i>
                    <p>No calculations added yet. Select a saved part and target quantity on the left, then click <strong>Add to Calculation</strong>.</p>
                </div>
            `;
            return;
        }

        // Group by Material Grade + Diameter
        const groups = {};
        calcItems.forEach(item => {
            const grade = (item.part.material_grade || 'MS').trim().toUpperCase();
            const dia = parseFloat(item.part.diameter) || 0;
            const length = parseFloat(item.part.length) || 0;
            const qty = item.target_qty || 0;

            const key = `${grade}_${dia}`;
            if (!groups[key]) {
                groups[key] = {
                    material_grade: item.part.material_grade || 'MS',
                    diameter: dia,
                    total_mm: 0
                };
            }
            groups[key].total_mm += (length * qty);
        });

        // Build HTML for each consolidated card
        container.innerHTML = Object.values(groups).map(g => {
            // Total length in feet: mm / 304.8
            const totalFeet = g.total_mm > 0 ? (g.total_mm / 304.8) : 0;
            
            // Standard round steel weight:
            // Volume = π * (d/2)² * Length_mm (mm³)
            // Steel density = 7.85 g/cm³ = 0.00000785 kg/mm³
            // Weight_kg = Volume * 0.00000785
            const radius = g.diameter / 2;
            const volumeMm3 = Math.PI * (radius * radius) * g.total_mm;
            const estWeightKg = volumeMm3 * 0.00000785;

            return `
                <div class="consolidated-item-box">
                    <div class="cons-left">
                        <span class="cons-grade">${g.material_grade}</span>
                        <span class="cons-dia-pill">Ø ${g.diameter} mm</span>
                    </div>
                    <div class="cons-right">
                        <div class="cons-metric">
                            <span class="cons-metric-label">TOTAL LENGTH</span>
                            <span class="cons-metric-val">${totalFeet.toFixed(2)} Feet</span>
                        </div>
                        <div class="cons-metric">
                            <span class="cons-metric-label">EST. WEIGHT</span>
                            <span class="cons-metric-val green">${estWeightKg.toFixed(2)} Kg</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render Current Calculation Breakdown (Exact Match to Image 2 Bottom)
    function renderBreakdownTable() {
        const tbody = document.getElementById('breakdown-table-body');
        if (!tbody) return;

        if (calcItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        No items in current calculation breakdown.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = calcItems.map((item, idx) => {
            const p = item.part;
            const dwg = p.drawing_number ? `Dwg: ${p.drawing_number}` : (p.part_code ? `Dwg: ${p.part_code}` : '');
            const cat = p.category_name || 'COLI';
            const dia = p.diameter || 0;
            const len = p.length || 0;

            return `
                <tr>
                    <td>
                        <span class="breakdown-part-name">${p.part_name}</span>
                        <div class="breakdown-badges">
                            <span class="breakdown-cat-tag">${cat}</span>
                            ${dwg ? `<span class="breakdown-dwg">${dwg}</span>` : ''}
                        </div>
                    </td>
                    <td><strong>${p.material_grade || '—'}</strong></td>
                    <td>Ø${dia}mm × L${len}mm</td>
                    <td><strong class="breakdown-qty">${item.target_qty}</strong></td>
                    <td class="text-center">
                        <button class="btn-remove-calc" onclick="removeCalcItem(${idx})" title="Remove">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXECUTIVE DASHBOARD LOADER
    // ═══════════════════════════════════════════════════════════════════════
    async function loadDashboardData() {
        try {
            const [statsRes, partsRes, catRes, txRes] = await Promise.all([
                API.getInventoryStats(),
                API.getParts({ limit: 5, sort_by: 'created_at', order: 'DESC' }),
                API.getCategories(),
                API.getTransactions({ limit: 5 })
            ]);

            if (statsRes.success) {
                const s = statsRes.data;
                const partsEl = document.getElementById('dash-kpi-parts');
                const valEl = document.getElementById('dash-kpi-val');
                const lowEl = document.getElementById('dash-kpi-low-stock');

                if (partsEl) partsEl.innerText = s.totalParts;
                if (valEl) valEl.innerText = `₹${s.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                if (lowEl) lowEl.innerText = s.lowStockCount;
                const masterBadge = document.getElementById('sidebar-master-parts-count');
                const inventoryBadge = document.getElementById('sidebar-parts-count');
                if (masterBadge) masterBadge.innerText = s.totalParts;
                if (inventoryBadge) inventoryBadge.innerText = s.totalParts;
            }

            if (catRes.success) {
                const catEl = document.getElementById('dash-kpi-categories');
                if (catEl) catEl.innerText = (catRes.data || []).length;
                const categoryBadge = document.getElementById('sidebar-categories-count');
                if (categoryBadge) categoryBadge.innerText = (catRes.data || []).length;
            }

            renderDashboardGraphs(
                partsRes.success ? (partsRes.data || []) : [],
                catRes.success ? (catRes.data || []) : [],
                txRes.success ? (txRes.data || []) : []
            );

            // Render Recent Parts
            const recentTbody = document.getElementById('dash-recent-parts-tbody');
            if (recentTbody && partsRes.success) {
                const parts = (partsRes.data || []).slice(0, 5);
                if (parts.length === 0) {
                    recentTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No Master Parts yet.</td></tr>';
                } else {
                    recentTbody.innerHTML = parts.map(p => {
                        const diaText = p.diameter ? `Ø${p.diameter} mm` : '—';
                        const lenText = p.length ? `L ${p.length} mm` : '—';
                        return `
                            <tr>
                                <td><strong style="color:var(--text-main);">${p.part_name}</strong></td>
                                <td><strong style="color:#2563eb;">${p.drawing_number || '—'}</strong></td>
                                <td>${p.material_grade || '—'}</td>
                                <td>${diaText} × ${lenText}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Render Recent Transactions Activity Feed
            const feed = document.getElementById('dash-activity-feed');
            if (feed && txRes.success) {
                const txs = (txRes.data || []).slice(0, 5);
                if (txs.length === 0) {
                    feed.innerHTML = '<li class="text-muted text-center py-4">No recent stock movements recorded.</li>';
                } else {
                    feed.innerHTML = txs.map(t => {
                        const iconClass = t.type === 'IN' ? 'in' : 'out';
                        const iconSymbol = t.type === 'IN' ? 'fa-arrow-down' : 'fa-arrow-up';
                        const sign = t.type === 'IN' ? '+' : '-';
                        return `
                            <li class="activity-feed-item">
                                <div class="activity-icon ${iconClass}">
                                    <i class="fa-solid ${iconSymbol}"></i>
                                </div>
                                <div style="flex:1;">
                                    <div style="display:flex; justify-content:space-between;">
                                        <strong style="font-size:0.88rem; color:var(--text-main);">${t.part_name}</strong>
                                        <strong style="font-size:0.88rem; color:${t.type === 'IN' ? '#16a34a' : '#ef4444'};">${sign}${t.quantity}</strong>
                                    </div>
                                    <small class="text-muted" style="font-size:0.75rem;">${t.reason} • ${t.created_at}</small>
                                </div>
                            </li>
                        `;
                    }).join('');
                }
            }
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        }
    }
    window.loadDashboardData = loadDashboardData;

    function renderDashboardGraphs(parts, categories, transactions) {
        const categoryChart = document.getElementById('dash-category-chart');
        if (categoryChart) {
            const categoryData = categories
                .map(c => ({ name: c.name, count: Number(c.parts_count) || parts.filter(p => p.category_id === c.id).length }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 7);
            const max = Math.max(1, ...categoryData.map(c => c.count));
            categoryChart.innerHTML = categoryData.length ? categoryData.map(c => `
                <div class="chart-bar-row" title="${c.name}: ${c.count} parts">
                    <span class="chart-bar-label">${c.name}</span>
                    <span class="chart-bar-track"><span class="chart-bar-fill" style="display:block;width:${(c.count / max) * 100}%"></span></span>
                    <span class="chart-bar-value">${c.count}</span>
                </div>`).join('') : '<div class="chart-empty">No category data available.</div>';
        }

        const stockChart = document.getElementById('dash-stock-chart');
        if (stockChart) {
            const total = parts.length;
            const out = parts.filter(p => Number(p.current_stock) <= 0).length;
            const low = parts.filter(p => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock_level)).length;
            const healthy = Math.max(0, total - out - low);
            const healthyPct = total ? (healthy / total) * 100 : 0;
            const lowPct = total ? (low / total) * 100 : 0;
            stockChart.innerHTML = total ? `
                <div class="stock-donut" style="background:conic-gradient(#10b981 0 ${healthyPct}%, #f59e0b ${healthyPct}% ${healthyPct + lowPct}%, #ef4444 ${healthyPct + lowPct}% 100%)">
                    <div class="stock-donut-center"><strong>${total}</strong><span>Total Parts</span></div>
                </div>
                <div class="chart-legend">
                    <span><i style="background:#10b981"></i>Healthy ${healthy}</span>
                    <span><i style="background:#f59e0b"></i>Low ${low}</span>
                    <span><i style="background:#ef4444"></i>Out ${out}</span>
                </div>` : '<div class="chart-empty">No stock data available.</div>';
        }

        const movementChart = document.getElementById('dash-movement-chart');
        if (movementChart) {
            const recent = transactions.slice(0, 8).reverse();
            const maxQty = Math.max(1, ...recent.map(t => Number(t.quantity) || 0));
            movementChart.innerHTML = recent.length ? recent.map(t => {
                const height = Math.max(3, ((Number(t.quantity) || 0) / maxQty) * 145);
                return `<div class="movement-column" title="${t.part_name}: ${t.type} ${t.quantity}">
                    <span class="movement-value">${t.type === 'IN' ? '+' : '-'}${t.quantity}</span>
                    <span class="movement-bar ${t.type.toLowerCase()}" style="height:${height}px"></span>
                    <span class="movement-label">${t.part_code || t.part_name}</span>
                </div>`;
            }).join('') : '<div class="chart-empty">No stock movements yet.</div>';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // USERS & ROLE-BASED PERMISSIONS MANAGEMENT (ADMIN)
    // ═══════════════════════════════════════════════════════════════════════
    async function loadUsersData(search = '') {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        try {
            const res = await API.getUsers();
            if (res.success) {
                let users = res.data || [];
                const badge = document.getElementById('sidebar-users-count');
                if (badge) badge.innerText = users.length;

                if (search) {
                    const q = search.toLowerCase();
                    users = users.filter(u => 
                        (u.username && u.username.toLowerCase().includes(q)) ||
                        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                        (u.role && u.role.toLowerCase().includes(q))
                    );
                }

                if (users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No users found.</td></tr>';
                    return;
                }

                tbody.innerHTML = users.map(u => {
                    const initials = (u.full_name || u.username).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                    const roleClass = u.role;
                    const allowedSections = permissionModules.filter(([module]) => u.role === 'admin' || u.permissions?.[module]?.view).length;
                    const permissionSummary = u.role === 'admin'
                        ? '<span class="permission-pill granted"><i class="fa-solid fa-shield"></i> Full Access</span>'
                        : `<span class="permission-pill granted">${allowedSections} / ${permissionModules.length} sections</span>`;
                    const statusBadge = u.status === 'active' 
                        ? '<span class="badge badge-success">Active</span>' 
                        : '<span class="badge badge-muted">Inactive</span>';

                    return `
                        <tr>
                            <td>
                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                    <div class="user-avatar-badge">${initials}</div>
                                    <div>
                                        <strong style="color:var(--text-main); font-size:0.92rem; display:block;">${u.full_name}</strong>
                                        <small class="text-muted">ID #${u.id}</small>
                                    </div>
                                </div>
                            </td>
                            <td><code>${u.username}</code></td>
                            <td><span class="role-badge ${roleClass}">${formatRoleName(u.role)}</span></td>
                            <td>${permissionSummary}</td>
                            <td class="text-center">${statusBadge}</td>
                            <td class="text-right">
                                <div style="display:inline-flex; gap:0.4rem; justify-content:flex-end;">
                                    ${hasPermission('users', 'edit') ? `<button class="btn btn-outline btn-sm" onclick="openEditUserModal(${u.id})" title="Edit User">
                                        <i class="fa-solid fa-pen"></i> Edit
                                    </button>` : ''}
                                    ${hasPermission('users', 'delete') && u.id !== 1 && u.username !== 'admin' ? `
                                        <button class="btn btn-danger btn-sm" onclick="deleteUserItem(${u.id}, '${u.username}')" title="Delete User">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-danger">Failed to load users list.</td></tr>';
        }
    }
    window.loadUsersData = loadUsersData;

    function openCreateUserModal() {
        document.getElementById('form-user').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-username').readOnly = false;
        document.getElementById('user-password').required = true;
        document.getElementById('modal-user-title').innerHTML = `<i class="fa-solid fa-user-plus"></i> Add New User`;
        document.getElementById('btn-modal-submit-user').innerHTML = `<i class="fa-solid fa-plus"></i> Create User`;
        applyRoleDefaultPermissions('store');
        openModal('modal-user');
    }
    window.openCreateUserModal = openCreateUserModal;

    async function openEditUserModal(id) {
        try {
            const res = await API.getUserById(id);
            if (res.success) {
                const u = res.data;
                document.getElementById('user-id').value = u.id;
                document.getElementById('user-username').value = u.username;
                document.getElementById('user-username').readOnly = true;
                document.getElementById('user-fullname').value = u.full_name;
                document.getElementById('user-role').value = u.role;
                document.getElementById('user-password').value = '';
                document.getElementById('user-password').required = false;
                renderPermissionMatrix(u.permissions || {}, u.role === 'admin');
                document.getElementById('user-status').value = u.status || 'active';

                document.getElementById('modal-user-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit User (${u.username})`;
                document.getElementById('btn-modal-submit-user').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save User`;
                openModal('modal-user');
            }
        } catch (err) {
            showToast('Failed to fetch user details', 'error');
        }
    }
    window.openEditUserModal = openEditUserModal;

    window.applyRoleDefaultPermissions = function(role) {
        const defaults = {};
        permissionModules.forEach(([module]) => {
            const admin = role === 'admin';
            const vendor = role === 'vendor';
            defaults[module] = {
                view: admin || module !== 'users',
                create: admin || (!vendor && module !== 'users'),
                edit: admin || (!vendor && module !== 'users'),
                delete: admin
            };
        });
        renderPermissionMatrix(defaults, role === 'admin');
    };

    function renderPermissionMatrix(permissions = {}, locked = false) {
        const body = document.getElementById('user-permissions-body');
        if (!body) return;
        body.innerHTML = permissionModules.map(([module, label]) => {
            const p = permissions[module] || {};
            return `<tr><td>${label}</td>${['view', 'create', 'edit', 'delete'].map(action =>
                `<td><input type="checkbox" data-permission-module="${module}" data-permission-action="${action}" ${p[action] ? 'checked' : ''} ${locked ? 'disabled' : ''}></td>`
            ).join('')}</tr>`;
        }).join('');
    }

    function collectPermissionMatrix() {
        const permissions = {};
        permissionModules.forEach(([module]) => permissions[module] = { view: false, create: false, edit: false, delete: false });
        document.querySelectorAll('[data-permission-module]').forEach(input => {
            permissions[input.dataset.permissionModule][input.dataset.permissionAction] = input.checked;
        });
        return permissions;
    }

    window.handleUserSubmit = async function(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value.trim();
        const full_name = document.getElementById('user-fullname').value.trim();
        const role = document.getElementById('user-role').value;
        const password = document.getElementById('user-password').value;
        const permissions = collectPermissionMatrix();
        const status = document.getElementById('user-status').value;

        if (!username || !full_name) {
            showToast('Username and Full Name are required', 'error');
            return;
        }

        if (!id && !password) {
            showToast('Password is required for new user', 'error');
            return;
        }

        const userData = { username, full_name, role, password, permissions, status };
        const submitBtn = document.getElementById('btn-modal-submit-user');
        if (submitBtn) submitBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await API.updateUser(id, userData);
            } else {
                res = await API.createUser(userData);
            }

            if (submitBtn) submitBtn.disabled = false;

            if (res && res.success) {
                showToast(res.message, 'success');
                closeModal('modal-user');
                loadUsersData();
            } else {
                showToast(res?.message || 'Failed to save user', 'error');
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            showToast('Server error processing user', 'error');
        }
    };

    document.getElementById('form-user')?.addEventListener('submit', window.handleUserSubmit);

    window.deleteUserItem = async function(id, username) {
        if (confirm(`Are you sure you want to delete user account "${username}"?`)) {
            try {
                const res = await API.deleteUser(id);
                if (res.success) {
                    showToast(res.message, 'success');
                    loadUsersData();
                } else {
                    showToast(res.message || 'Failed to delete user', 'error');
                }
            } catch (err) {
                showToast('Server error deleting user', 'error');
            }
        }
    };

    document.getElementById('btn-open-create-user')?.addEventListener('click', openCreateUserModal);
    document.getElementById('btn-refresh-users')?.addEventListener('click', () => {
        const query = document.getElementById('users-search')?.value.trim() || '';
        loadUsersData(query);
    });
    document.getElementById('users-search')?.addEventListener('input', (e) => {
        loadUsersData(e.target.value.trim());
    });

    // ═══════════════════════════════════════════════════════════════════════
    // COMPANY BUSINESS PROFILE & ADMIN SETTINGS
    // ═══════════════════════════════════════════════════════════════════════
    let currentCompanySettings = null;

    async function loadCompanySettings() {
        try {
            const res = await API.getCompanySettings();
            if (res.success && res.data) {
                currentCompanySettings = res.data;
                applyCompanyBrandingUI(currentCompanySettings);
            }
        } catch (e) {
            console.error('Failed to load company settings:', e);
        }
    }
    window.loadCompanySettings = loadCompanySettings;

    function applyCompanyBrandingUI(settings) {
        if (!settings) return;
        
        // Sidebar Branding
        const titleEl = document.getElementById('sidebar-company-title');
        const tagEl = document.getElementById('sidebar-company-tagline');
        const customLogo = document.getElementById('sidebar-custom-logo');
        const defaultIcon = document.getElementById('sidebar-default-icon');

        if (titleEl && settings.company_name) {
            titleEl.innerText = settings.company_name.toUpperCase();
        }
        if (tagEl && settings.tagline) {
            tagEl.innerText = settings.tagline.toUpperCase();
        }

        if (settings.logo_data) {
            if (customLogo) {
                customLogo.src = settings.logo_data;
                customLogo.style.display = 'block';
            }
            if (defaultIcon) defaultIcon.style.display = 'none';
        } else {
            if (customLogo) customLogo.style.display = 'none';
            if (defaultIcon) defaultIcon.style.display = 'block';
        }
    }

    async function openAdminSettingsModal(tab = 'company') {
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (!isAdmin && tab !== 'password') {
            tab = 'password';
        }

        // Toggle modal tab headers based on admin role
        const companyTabBtn = document.querySelector('.settings-tab-btn[data-settings-tab="company"]');
        const profileTabBtn = document.querySelector('.settings-tab-btn[data-settings-tab="profile"]');
        if (companyTabBtn) companyTabBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        if (profileTabBtn) profileTabBtn.style.display = isAdmin ? 'inline-flex' : 'none';

        const modalTitle = document.getElementById('modal-settings-title');
        if (modalTitle) {
            modalTitle.innerHTML = isAdmin 
                ? '<i class="fa-solid fa-building-gear text-primary"></i> Business Profile & Admin Settings'
                : '<i class="fa-solid fa-key text-warning"></i> Change Password';
        }

        switchSettingsModalTab(tab);
        openModal('modal-admin-profile');

        // Populate Company Settings (Admin only)
        if (isAdmin) {
            try {
                const res = await API.getCompanySettings();
                if (res.success && res.data) {
                    const s = res.data;
                    currentCompanySettings = s;
                    document.getElementById('setting-company-name').value = s.company_name || '';
                    document.getElementById('setting-gst').value = s.gst_number || '';
                    document.getElementById('setting-tagline').value = s.tagline || '';
                    document.getElementById('setting-phone').value = s.phone || '';
                    document.getElementById('setting-email').value = s.email || '';
                    document.getElementById('setting-website').value = s.website || '';
                    document.getElementById('setting-address').value = s.address || '';

                    const previewImg = document.getElementById('setting-logo-preview-img');
                    const placeholder = document.getElementById('setting-logo-placeholder');
                    const removeBtn = document.getElementById('btn-remove-logo');

                    if (s.logo_data) {
                        previewImg.src = s.logo_data;
                        previewImg.style.display = 'block';
                        placeholder.style.display = 'none';
                        removeBtn.style.display = 'inline-flex';
                    } else {
                        previewImg.src = '';
                        previewImg.style.display = 'none';
                        placeholder.style.display = 'flex';
                        removeBtn.style.display = 'none';
                    }
                }
            } catch (e) {}

            // Populate Admin Profile
            if (currentUser) {
                document.getElementById('admin-profile-fullname').value = currentUser.full_name || '';
                document.getElementById('admin-profile-username').value = currentUser.username || '';
                document.getElementById('admin-profile-email').value = currentUser.email || '';
                document.getElementById('admin-profile-phone').value = currentUser.phone || '';
            }
        }

        // Reset Password fields
        document.getElementById('form-change-password')?.reset();
        const pwdErr = document.getElementById('pwd-change-error');
        if (pwdErr) pwdErr.style.display = 'none';
    }
    window.openAdminSettingsModal = openAdminSettingsModal;

    function switchSettingsModalTab(tabName) {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-settings-tab') === tabName);
        });
        document.querySelectorAll('.settings-tab-pane').forEach(pane => {
            pane.style.display = pane.getAttribute('data-settings-pane') === tabName ? 'block' : 'none';
        });
    }
    window.switchSettingsModalTab = switchSettingsModalTab;

    // Logo Upload Handlers
    window.handleLogoFileSelected = function(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            showToast('Logo file size must be less than 3MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Data = event.target.result;
            const previewImg = document.getElementById('setting-logo-preview-img');
            const placeholder = document.getElementById('setting-logo-placeholder');
            const removeBtn = document.getElementById('btn-remove-logo');

            previewImg.src = base64Data;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
    };

    window.handleRemoveLogo = function() {
        const previewImg = document.getElementById('setting-logo-preview-img');
        const placeholder = document.getElementById('setting-logo-placeholder');
        const removeBtn = document.getElementById('btn-remove-logo');
        const fileInput = document.getElementById('setting-logo-input');

        previewImg.src = '';
        previewImg.style.display = 'none';
        placeholder.style.display = 'flex';
        removeBtn.style.display = 'none';
        if (fileInput) fileInput.value = '';
    };

    window.handleSaveCompanySettings = async function(e) {
        if (e) e.preventDefault();
        const company_name = document.getElementById('setting-company-name').value.trim();
        const gst_number = document.getElementById('setting-gst').value.trim();
        const tagline = document.getElementById('setting-tagline').value.trim();
        const phone = document.getElementById('setting-phone').value.trim();
        const email = document.getElementById('setting-email').value.trim();
        const website = document.getElementById('setting-website').value.trim();
        const address = document.getElementById('setting-address').value.trim();

        const previewImg = document.getElementById('setting-logo-preview-img');
        const logo_data = previewImg.style.display !== 'none' ? previewImg.src : '';

        if (!company_name) {
            showToast('Company Name is required', 'error');
            return;
        }

        const data = {
            company_name,
            gst_number,
            tagline,
            phone,
            email,
            website,
            address,
            logo_data
        };

        const submitBtn = document.getElementById('btn-save-company-settings');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await API.updateCompanySettings(data);
            if (submitBtn) submitBtn.disabled = false;

            if (res.success) {
                showToast(res.message || 'Company details updated successfully', 'success');
                currentCompanySettings = res.data;
                applyCompanyBrandingUI(res.data);
                closeModal('modal-admin-profile');
            } else {
                showToast(res.message || 'Failed to update company details', 'error');
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            showToast('Server error saving company details', 'error');
        }
    };

    window.handleSaveAdminProfile = async function(e) {
        if (e) e.preventDefault();
        const full_name = document.getElementById('admin-profile-fullname').value.trim();
        const email = document.getElementById('admin-profile-email').value.trim();
        const phone = document.getElementById('admin-profile-phone').value.trim();

        if (!full_name) {
            showToast('Full Name is required', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-save-admin-profile');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await API.updateProfile({ full_name, email, phone });
            if (submitBtn) submitBtn.disabled = false;

            if (res.success) {
                currentUser = res.user;
                localStorage.setItem('crystal_crm_user', JSON.stringify(currentUser));
                updateUserProfileUI();
                showToast('Profile updated successfully!', 'success');
                closeModal('modal-admin-profile');
            } else {
                showToast(res.message || 'Failed to update profile', 'error');
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            showToast('Server error updating profile', 'error');
        }
    };

    window.handleChangePasswordSubmit = async function(e) {
        if (e) e.preventDefault();
        const current_password = document.getElementById('pwd-current').value;
        const new_password = document.getElementById('pwd-new').value;
        const confirm_password = document.getElementById('pwd-confirm').value;
        const errBox = document.getElementById('pwd-change-error');

        if (errBox) errBox.style.display = 'none';

        if (!current_password || !new_password) {
            showToast('Current password and new password are required', 'error');
            return;
        }

        if (new_password.length < 6) {
            if (errBox) {
                errBox.innerText = 'New password must be at least 6 characters long';
                errBox.style.display = 'block';
            }
            return;
        }

        if (new_password !== confirm_password) {
            if (errBox) {
                errBox.innerText = 'New password and confirmation password do not match';
                errBox.style.display = 'block';
            }
            return;
        }

        const submitBtn = document.getElementById('btn-submit-change-pwd');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await API.changePassword({ current_password, new_password, confirm_password });
            if (submitBtn) submitBtn.disabled = false;

            if (res.success) {
                showToast('Password changed successfully!', 'success');
                document.getElementById('form-change-password').reset();
                closeModal('modal-admin-profile');
            } else {
                if (errBox) {
                    errBox.innerText = res.message || 'Failed to change password';
                    errBox.style.display = 'block';
                } else {
                    showToast(res.message || 'Failed to change password', 'error');
                }
            }
        } catch (err) {
            if (submitBtn) submitBtn.disabled = false;
            showToast('Server error changing password', 'error');
        }
    };

    window.toggleEyePwd = function(inputId, btn) {
        const input = document.getElementById(inputId);
        const icon = btn.querySelector('i');
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fa-solid fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fa-solid fa-eye';
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // INITIAL APP LOAD (WITH AUTH GUARD)
    // ═══════════════════════════════════════════════════════════════════════
    async function initializeAuthenticatedApp() {
        if (currentUser) {
            try {
                const session = await API.getCurrentUser();
                if (session.success && session.user) {
                    currentUser = session.user;
                    localStorage.setItem('crystal_crm_user', JSON.stringify(currentUser));
                } else {
                    currentUser = null;
                    localStorage.removeItem('crystal_crm_user');
                }
            } catch (err) {
                currentUser = null;
                localStorage.removeItem('crystal_crm_user');
            }
        }
        if (checkAuth()) {
            await loadCompanySettings();
            await loadCategories();
            const firstAllowed = permissionModules.find(([module]) => hasPermission(module, 'view'))?.[0] || 'dashboard';
            switchTab(firstAllowed === 'master_parts' ? 'master-parts' : firstAllowed);
        }
    }
    initializeAuthenticatedApp();

});
