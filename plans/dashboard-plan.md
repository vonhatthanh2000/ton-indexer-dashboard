# Blockchain Dashboard – Design & Feature Specification

## 1. Overview

A web dashboard for monitoring blockchain projects. It has two separate workspaces, one per role:

| Role | Workspace | Scope |
|---|---|---|
| **Admin** | Admin workspace | Creates and manages all projects and project managers |
| **Project Manager** | Project workspace | Works on their assigned project only |

Both workspaces share the same visual style and component library. Only the navigation and the data differ.

---

## 2. Visual Style

### 2.1 General feel
- Clean, light and airy, with generous white space
- All content sits inside white rounded cards on a light gray page background
- One primary accent color does most of the visual work, with green and red used only for status and change indicators

### 2.2 Colors

| Token | Value | Usage |
|---|---|---|
| Background | `#F9FAFB` | Page background |
| Surface | `#FFFFFF` | Cards, sidebar, top bar |
| Border | `#E4E7EC` | Card borders, table dividers, inputs |
| Primary | `#465FFF` | Charts, links, active states, primary buttons |
| Primary light | `#ECF3FF` | Active menu item background, soft pills |
| Text primary | `#1D2939` | Titles, numbers, table values |
| Text secondary | `#667085` | Labels, captions, table headers |
| Success | `#039855` on `#ECFDF3` | Positive change, "Success" status |
| Warning | `#DC6803` on `#FFFAEB` | "Pending" / "Paused" status |
| Error | `#D92D20` on `#FEF3F2` | Negative change, "Failed" status |

**Dark mode** (toggle in the top bar): background `#0C111D`, surface `#1A2231`, border `#2A3445`. The primary color stays the same.

### 2.3 Typography
- **Main font:** a clean geometric sans-serif
- **Monospace font:** only for transaction hashes, addresses and block numbers

| Element | Size | Weight |
|---|---|---|
| Page title | 24px | Semibold |
| Card title | 18px | Semibold |
| KPI number | 30px | Bold |
| Body / table text | 14px | Regular |
| Labels / captions | 12–14px | Regular, secondary color |

### 2.4 Shapes & spacing
- Card radius: **16px**
- Button / input radius: **8–12px**
- Pills: fully rounded
- Card border: 1px, no shadow or a very soft one
- Grid gap between cards: **24px**
- Card inner padding: **24px**

### 2.5 Icons
- Thin outline icon set, about 20px
- On KPI cards, the icon sits inside a 48px light gray rounded square

---

## 3. Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│              │  Top bar                                     │
│   Sidebar    ├──────────────────────────────────────────────┤
│   (~290px)   │  Page title                    Breadcrumb    │
│              │                                              │
│              │  Content grid (12 columns, 24px gap)         │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 3.1 Sidebar
- White background with a thin right border
- Logo at the top
- Menu items grouped under small uppercase gray labels (e.g. `MENU`, `SUPPORT`)
- Each item has an outline icon and a label. Items with sub-pages show a chevron.
- **Active item:** primary-light background, primary-colored icon and text, rounded corners
- Collapsible to icons only via the hamburger button in the top bar

### 3.2 Top bar
- White, with a thin bottom border
- Left: hamburger button (square, bordered), then a wide rounded search input with a search icon and a `⌘K` shortcut hint
- Right: round bordered icon buttons for dark mode and notifications (with a small orange dot for unread), then an avatar, user name and dropdown arrow

### 3.3 Page header
- Page title on the left
- Breadcrumb on the right (e.g. `Dashboard / Transactions`), with the current page in the primary color

---

## 4. Components

### 4.1 KPI card
- Icon in a gray rounded square at the top
- Label in secondary text
- Large bold number
- Change pill on the right: `↑ 11.01%` (green) or `↓ 9.05%` (red)

### 4.2 Chart card
- Title on the left, ⋮ menu on the right
- **Bar chart:** thin rounded bars in the primary color, faint horizontal gridlines only, no vertical lines
- **Area chart:** smooth line with a soft gradient fill fading to transparent
- Optional segmented control in the header (e.g. `Overview | Volume | Wallets`) and a date range picker

### 4.3 Table card
- Header: title and subtitle on the left; search, filter and action buttons on the right
- Column headers in small secondary text
- Rows about 64px tall, separated by thin dividers
- Pagination at the bottom right: small rounded square buttons, with the active page filled in the primary color

### 4.4 Address / hash chip
- Round identicon avatar (generated from the address)
- Truncated value in monospace: `0x4f3a…9c21`
- Shown as a link in the primary color
- Gray copy icon, with a "Copied" tooltip after clicking

### 4.5 Pills
- **Status:** Success (green), Pending (orange), Failed (red), Active (green), Paused (orange)
- **Type:** soft primary pill (e.g. `ERC20`)
- **Network:** soft gray pill with a small colored dot

### 4.6 Other
- **Buttons:** primary (filled), secondary (white with border)
- **Forms:** labeled inputs with 1px borders and the primary color on focus
- **Empty state:** icon, short message, optional action button
- **Loading:** gray skeleton blocks in the same shape as the content
- **Time:** relative ("2 minutes ago"), with the full timestamp in a tooltip
- **Numbers:** compact (1.24M), with the exact value in a tooltip

---

## 5. Roles & Access

- One login page. After sign-in, the user is redirected by role:
  - Admin → `/admin`
  - Project Manager → `/project`
- A Project Manager can only see data from their assigned project. This is enforced on the server, not just hidden in the UI.
- Opening a page outside the user's role shows a "No access" empty state.
- **Role indicator:**
  - Admin: a small "Admin" pill next to the logo
  - Project Manager: a project card at the top of the sidebar (project logo, name, network pill)

---

## 6. Admin Workspace

### Sidebar
- **MENU:** Dashboard · Projects · Project Managers
- **SUPPORT:** Settings

### 6.1 Dashboard
- **Row 1:** KPI cards for Total Projects, Active Projects and Total Transactions
- **Row 2:** bar chart card "Transactions per Month"
- **Row 3:** table card "Recent Projects" (5 rows, with a "View all →" link)

### 6.2 Projects
Table card with a **+ Create Project** primary button in the header.

| Column | Content |
|---|---|
| Project | Logo and name |
| Network | Network pill |
| Manager | Avatar and name |
| Transactions | Count |
| Status | Active / Paused pill |
| Created | Relative time |
| Actions | ⋮ menu: View, Edit, Pause |

Includes search by project name and pagination.

### 6.3 Create Project
A single form card:
- Project name
- Network (select)
- Contract address (validated format)
- Assign manager (select an existing manager)
- Buttons at the bottom right: **Cancel** (secondary), **Create** (primary)

On success, show a toast and redirect to the Projects list.

### 6.4 Project Managers
Table card with an **Invite** primary button in the header.

| Column | Content |
|---|---|
| Name | Avatar and name |
| Email | Text |
| Assigned project | Project name |
| Status | Active / Invited pill |

### 6.5 Settings
Admin profile (name, email, password).

---

## 7. Project Manager Workspace

### Sidebar
- **Project card** at the top
- **MENU:** Dashboard · Transactions · Tokens · Accounts
- **SUPPORT:** Settings

### 7.1 Dashboard
- **Row 1:** KPI cards for Transactions (24h), Unique Wallets and Success Rate
- **Row 2:** bar chart card "Daily Transactions"
- **Row 3:** table card "Latest Transactions" (5 rows, with a "View all →" link)

### 7.2 Transactions

| Column | Content |
|---|---|
| Tx Hash | Hash chip with copy |
| From → To | Two address chips with an arrow |
| Value | Amount and token symbol |
| Status | Success / Pending / Failed pill |
| Time | Relative time |

Includes search by hash or address, and pagination.

### 7.3 Tokens

| Column | Content |
|---|---|
| Token | Name and symbol |
| Type | Type pill (e.g. `ERC20`) |
| Contract address | Address chip with copy |
| Total supply | Compact number |
| Holders | Count |

### 7.4 Accounts

| Column | Content |
|---|---|
| Address | Address chip with copy |
| Balance | Amount |
| Txns | Count |
| Last active | Relative time |

### 7.5 Settings
- Project info (read-only): name, network, contract address
- Manager's own profile (editable): name, email, password

---

## 8. Responsive Behavior
- **Desktop (≥1280px):** full sidebar, multi-column grid
- **Tablet (768–1279px):** sidebar collapsed to icons; KPI cards in 2 columns
- **Mobile (<768px):** sidebar becomes a slide-in drawer; cards stack in 1 column; tables scroll horizontally