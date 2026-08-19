# Graph Report - .  (2026-08-17)

## Corpus Check
- Corpus is ~7,004 words - fits in a single context window. You may not need a graph.

## Summary
- 88 nodes · 78 edges · 22 communities (4 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend Server & Auth
- Platform UI & Features
- Express Dependency
- Internationalization
- School Data Loading
- Password Hashing
- Request Parsing
- Response Compression
- Session Store
- Cross-Origin Sharing
- Environment Config
- Rate Limiting
- Session Management
- Security Headers
- API Client
- App Entry Point
- Auth Client
- UI Components
- App Configuration
- Dashboard Logic
- State Management
- PostgreSQL Driver

## God Nodes (most connected - your core abstractions)
1. `Abugida Platform` - 10 edges
2. `Parent Dashboard` - 3 edges
3. `Authentication Flow` - 3 edges
4. `Children Management` - 3 edges
5. `t()` - 2 edges
6. `applyTranslations()` - 2 edges
7. `bcrypt` - 2 edges
8. `body-parser` - 2 edges
9. `compression` - 2 edges
10. `connect-pg-simple` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Schools Directory` --references--> `Ethiopian Schools List`  [INFERRED]
  index.html → schools.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Core Platform Features** — index_html_academic_tracking, index_html_communication_feature, index_html_events_feature, index_html_fees_feature [EXTRACTED 0.95]
- **Registration Flow** — index_html_auth_flow, index_html_otp_verification, index_html_registration_steps, index_html_children_management [EXTRACTED 0.95]
- **Dashboard UI Components** — index_html_parent_dashboard, index_html_sidebar_navigation, index_html_toast_notifications, index_html_loading_overlay [EXTRACTED 0.90]

## Communities (22 total, 18 thin omitted)

### Community 0 - "Backend Server & Auth"
Cohesion: 0.08
Nodes (18): apiLimiter, app, bcrypt, bodyParser, compression, connectPgSimple, cors, crypto (+10 more)

### Community 1 - "Platform UI & Features"
Cohesion: 0.12
Nodes (17): Abugida Platform, Academic Tracking Feature, Authentication Flow, Children Management, Communication Feature, Events Feature, Fees Feature, Internationalization (i18n) (+9 more)

### Community 2 - "Express Dependency"
Cohesion: 0.50
Nodes (3): express, dependencies, express

### Community 3 - "Internationalization"
Cohesion: 0.67
Nodes (3): applyTranslations(), I18N, t()

## Knowledge Gaps
- **50 isolated node(s):** `api`, `App`, `Auth`, `UI`, `CONFIG` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Express Dependency` to `Password Hashing`, `Request Parsing`, `Response Compression`, `Session Store`, `Cross-Origin Sharing`, `Environment Config`, `Rate Limiting`, `Session Management`, `Security Headers`, `PostgreSQL Driver`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `api`, `App`, `Auth` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Server & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Platform UI & Features` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._