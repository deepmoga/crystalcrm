# Crystal Agro CRM & ERP System

An industrial ERP and Inventory Management Portal for agricultural machinery and precision parts manufacturing.

---

## 🌟 Key Features

1. **Dashboard & Live Analytics**:
   - Total Master Parts, Physical Stock Valuation, Low Stock Alerts, Total Stock Movements.
2. **Master Parts Catalog (`master-parts`)**:
   - Pure engineering specifications catalog (Part Code, Drawing Number, Material Grade, Diameter Ø, Length L, Category).
3. **Material Planner & Weight Calculator (`planner`)**:
   - Production requirement calculations, total length & theoretical round bar weight estimation with audit history.
4. **Master Categories**:
   - Categorization for parts, machine assemblies, hydraulics, electricals, blades, and raw materials.
5. **Physical Inventory Stock (`inventory`)**:
   - Stock balances, warehouse locations, unit pricing, safety threshold alerts, quick Stock IN/OUT operations, and transaction audit logs.
6. **Multi-Vendor & Purchasing Module (`billing`)**:
   - Vendor directory, purchase invoice creation with tax / GST calculations, automatic stock reception, and PDF invoice generation.
7. **Role-Based Access Control (RBAC)**:
   - 4 built-in roles (`admin`, `store`, `planner`, `vendor`) with custom module permissions (View, Create, Edit, Delete).
8. **Company Profile & Branding**:
   - Custom Logo upload, Business Name, GST Number, Factory Address, and Contact details.
   - Dark & Light mode theme switcher.

---

## 🗄️ Database Setup (MySQL / phpMyAdmin)

1. Open **phpMyAdmin** or your MySQL client.
2. Create a database (e.g. `crystal_agro_crm` or `exopfnhh_crmcrystal`).
3. *(Optional)* Import [`database/crystal_agro_crm.sql`](database/crystal_agro_crm.sql).
4. Configure your `.env` file:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=crystal_agro_crm
   SESSION_SECRET=crystal-agro-crm-secret-key
   ```

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start CRM server
npm start
```

Open your browser at **http://localhost:5000**

---

## 🔑 Default Login Credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| **System Administrator** | `admin` | `admin123` |
| **Store Manager** | `store` | `store123` |
| **Production Planner** | `planner` | `planner123` |
| **Vendor / Supplier** | `vendor` | `vendor123` |
