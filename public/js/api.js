// API Client Wrapper for Crystal Agro CRM
const API_BASE = '/api';

const API = {
    // Authentication APIs
    async login(credentials) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        return await res.json();
    },

    async getCurrentUser(userId) {
        const headers = userId ? { 'x-user-id': userId } : {};
        const res = await fetch(`${API_BASE}/auth/me`, { headers });
        return await res.json();
    },

    async logout() {
        const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        return await res.json();
    },

    async updateProfile(profileData) {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        return await res.json();
    },

    async changePassword(passwordData) {
        const res = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(passwordData)
        });
        return await res.json();
    },

    // Company Business Settings APIs
    async getCompanySettings() {
        const res = await fetch(`${API_BASE}/settings/company`);
        return await res.json();
    },

    async updateCompanySettings(settingsData) {
        const res = await fetch(`${API_BASE}/settings/company`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsData)
        });
        return await res.json();
    },

    // Users & Permissions Management APIs
    async getUsers() {
        const res = await fetch(`${API_BASE}/users`);
        return await res.json();
    },

    async getUserById(id) {
        const res = await fetch(`${API_BASE}/users/${id}`);
        return await res.json();
    },

    async createUser(userData) {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await res.json();
    },

    async updateUser(id, userData) {
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await res.json();
    },

    async deleteUser(id) {
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE'
        });
        return await res.json();
    },

    // Inventory APIs
    async getInventoryStats() {
        const res = await fetch(`${API_BASE}/inventory/stats`);
        return await res.json();
    },

    async getParts(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/inventory?${query}`);
        return await res.json();
    },

    async getPartById(id) {
        const res = await fetch(`${API_BASE}/inventory/${id}`);
        return await res.json();
    },

    async createPart(partData) {
        const res = await fetch(`${API_BASE}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partData)
        });
        return await res.json();
    },

    async updatePart(id, partData) {
        const res = await fetch(`${API_BASE}/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partData)
        });
        return await res.json();
    },

    async addToInventory(inventoryData) {
        const res = await fetch(`${API_BASE}/inventory/add-to-inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inventoryData)
        });
        return await res.json();
    },

    async updateInventoryDetails(id, inventoryData) {
        const res = await fetch(`${API_BASE}/inventory/${id}/inventory-details`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inventoryData)
        });
        return res.json();
    },

    async removeFromInventory(id) {
        const res = await fetch(`${API_BASE}/inventory/${id}/remove-from-inventory`, {
            method: 'PUT'
        });
        return await res.json();
    },

    async deletePart(id) {
        const res = await fetch(`${API_BASE}/inventory/${id}`, {
            method: 'DELETE'
        });
        return await res.json();
    },

    // Category APIs
    async getCategories() {
        const res = await fetch(`${API_BASE}/categories`);
        return await res.json();
    },

    async createCategory(categoryData) {
        const res = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
        });
        return await res.json();
    },

    async updateCategory(id, categoryData) {
        const res = await fetch(`${API_BASE}/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
        });
        return await res.json();
    },

    async deleteCategory(id) {
        const res = await fetch(`${API_BASE}/categories/${id}`, {
            method: 'DELETE'
        });
        return await res.json();
    },

    // Transaction APIs
    async getTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/transactions?${query}`);
        return await res.json();
    },

    async createTransaction(txData) {
        const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txData)
        });
        return await res.json();
    },

    async getPlannerHistory() {
        const res = await fetch(`${API_BASE}/planner/history`);
        return await res.json();
    },

    async createPlannerCalculation(data) {
        const res = await fetch(`${API_BASE}/planner/calculations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    // Vendor Management APIs (Phase 2)
    async getVendors(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/vendors?${query}`);
        return await res.json();
    },

    async getVendorById(id) {
        const res = await fetch(`${API_BASE}/vendors/${id}`);
        return await res.json();
    },

    async createVendor(vendorData) {
        const res = await fetch(`${API_BASE}/vendors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendorData)
        });
        return await res.json();
    },

    async updateVendor(id, vendorData) {
        const res = await fetch(`${API_BASE}/vendors/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendorData)
        });
        return await res.json();
    },

    async deleteVendor(id) {
        const res = await fetch(`${API_BASE}/vendors/${id}`, {
            method: 'DELETE'
        });
        return await res.json();
    },

    // Purchase & Billing APIs (Phase 2)
    async getPurchaseStats() {
        const res = await fetch(`${API_BASE}/purchase-bills/stats`);
        return await res.json();
    },

    async getPurchaseBills(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/purchase-bills?${query}`);
        return await res.json();
    },

    async getPurchaseBillById(id) {
        const res = await fetch(`${API_BASE}/purchase-bills/${id}`);
        return await res.json();
    },

    async createPurchaseBill(billData) {
        const res = await fetch(`${API_BASE}/purchase-bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billData)
        });
        return await res.json();
    }
};
