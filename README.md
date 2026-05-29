# Team Task Tracker API

A production-ready REST API for a team-based task tracker with JWT authentication, role-based access control (RBAC) enforced at the middleware layer, Redis list caching, and containerized deployment.

---

## Technical Stack
* **Runtime:** Node.js (Express)
* **Database:** MongoDB (Mongoose ODM)
* **Caching:** Redis (ioredis)
* **Authentication:** JWT (Access + Refresh Token Rotation)
* **Containerization:** Docker & Docker Compose

---

## Getting Started

### Prerequisites
* Docker & Docker Compose installed on your machine.

### Run via Docker Compose
Simply run the following command at the root of the project:
```bash
docker compose up --build
```
This starts:
1. **MongoDB** container listening on `mongodb://localhost:27017`
2. **Redis** container listening on `redis://localhost:6379`
3. **API server** container listening on `http://localhost:5000`

---

## Database Design & Indexing Decisions

### Schema Overview

#### 1. Organization
* Represents the tenant boundary for user and task data.
* Fields:
  * `name` (String, required, trimmed)
  * `description` (String, trimmed)

#### 2. Project
* Represents projects within an organization.
* Fields:
  * `name` (String, required, trimmed)
  * `description` (String, trimmed)
  * `organizationId` (ObjectId ref Organization, required) - enforces tenant boundaries.

#### 3. User
* Represents organization members.
* Fields:
  * `name` (String, required, trimmed)
  * `email` (String, required, unique, lowercase, trimmed) - automatically indexed uniquely.
  * `password` (String, required, hashed via bcryptjs pre-save hook)
  * `role` (String, enum: `ADMIN`, `MANAGER`, `MEMBER`, default `MEMBER`)
  * `refreshToken` (String) - stores active refresh token for rotation verification.
  * `organizationId` (ObjectId ref Organization, required) - user belongs to exactly one organization.

#### 4. Task
* Fields:
  * `title` (String, required)
  * `description` (String)
  * `priority` (String, enum: `LOW`, `MEDIUM`, `HIGH`, default `MEDIUM`)
  * `status` (String, enum: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`, default `TODO`)
  * `assignee` (ObjectId ref User, optional)
  * `due_date` (Date, optional)
  * `completedAt` (Date, optional)
  * `projectId` (ObjectId ref Project, optional)
  * `organizationId` (ObjectId ref Organization, required)

---

### Indexing Decisions & Rationales

We added indexes to the `Task` collection to optimize frequent operational queries:

1. **`status: 1`**: Speeds up board column filters and general status queries.
2. **`assignee: 1`**: Speeds up finding tasks for a particular user.
3. **`due_date: 1`**: Speeds up deadline calendars and sorting tasks by urgency.
4. **`assignee: 1, status: 1` (Compound Index)**:
   * **Rationale:** The most critical/frequent view in the application is a user checking their active dashboard (e.g. `assignee = current_user` and `status != DONE` or `status = IN_PROGRESS`). 
   * A compound index on `{ assignee: 1, status: 1 }` allows MongoDB to satisfy assignee-specific status queries using a single index scan (Index Prefix Matching), avoiding expensive index intersections or in-memory filtering.

---

### Tenant Isolation Decision

* **Design Choice:** Storing `organizationId` directly on the `Task` document rather than traversing through the associated project.
* **Rationale:** Tasks might occasionally exist outside a specific project. More importantly, checking whether a task belongs to a user's organization must be done in middleware for every read/write action. Having `organizationId` on the task document allows the `authorizeTaskAccess` middleware to perform organization-level tenant isolation in a single query, without requiring a secondary join/fetch of the Project document.

---

## Redis Caching Strategy

The assignment requires Redis caching on task lists per assignee with a clear invalidation strategy.

### Caching Scope & Keys
* When a user queries tasks filtered by `assignee` (which is mandatory for `MEMBER` roles, and optional but frequent for `MANAGER`/`ADMIN` roles), the response payload is cached in Redis.
* **Cache Key Format:**
  ```
  tasks:assignee:{assigneeId}:org:{orgId}:page:{page}:limit:{limit}:status:{status}:priority:{priority}
  ```
* This key encapsulates all query parameters so different pagination settings or filters don't return mismatched cached results.
* Cached responses are set with a TTL (Time-To-Live) of **1 hour** (`3600 seconds`) to ensure eventual consistency even if a cache clearing command fails.

### Invalidation Strategy
We implement a **Proactive Write-Through Cache Invalidation** pattern. When task records are mutated, we target the exact cache keys that could contain stale data:

1. **Task Creation:** If a new task is created and assigned to User A, we invalidate all keys starting with `tasks:assignee:UserA:*`.
2. **Task Deletion:** If a task assigned to User A is deleted, we clear all keys matching `tasks:assignee:UserA:*`.
3. **Task Status / Detail Update:** If a task assigned to User A is updated (e.g., status changed from `IN_PROGRESS` to `IN_REVIEW`), we invalidate User A's cache.
4. **Reassignment (Edge Case Handling):** If a task is reassigned from User A to User B, we invalidate caches for **both** users (`tasks:assignee:UserA:*` and `tasks:assignee:UserB:*`). This ensures that User A's list immediately shows the task is gone, and User B's list immediately shows the task is added.

---

## API Endpoints List

### 1. Authentication (`/api/auth`)
* `POST /register`: Registers a new user. If `organizationName` is provided, a new organization is created. If `organizationId` is provided, user joins that organization.
* `POST /login`: Validates credentials and returns JWT Access Token (expires in 15m) and Refresh Token (expires in 7d).
* `POST /refresh`: Expects a valid refresh token. Rotates refresh tokens and returns a new Access + Refresh token pair.
* `POST /logout`: Invalidates the refresh token.

### 2. User Management (`/api/users`) - *ADMIN only*
* `POST /`: Create a user in the administrator's organization.
* `GET /`: Get all users in the administrator's organization.
* `GET /:id`: Get details of a single user in the organization.
* `PATCH /:id`: Update user details or role.
* `DELETE /:id`: Delete a user (prevents self-deletion).

### 3. Projects (`/api/projects`)
* `POST /`: Create a project (*ADMIN/MANAGER* only).
* `GET /`: Get all projects in the organization.
* `GET /:id`: Get single project by ID.
* `PATCH /:id`: Update project details (*ADMIN/MANAGER* only).
* `DELETE /:id`: Delete project (*ADMIN/MANAGER* only).

### 4. Tasks (`/api/tasks`)
* `POST /`: Create a task (*ADMIN/MANAGER* only). Assignee must belong to the organization.
* `GET /`: List tasks with filters (`assignee`, `status`, `priority`) and pagination (`page`, `limit`). Members can only view their own tasks. Assignee list queries are cached in Redis.
* `GET /:id`: Get single task. Members can only view if assigned to them.
* `PATCH /:id`: Update task details (*ADMIN/MANAGER* only).
* `PATCH /:id/status`: Advance task status. Only assignee or *MANAGER/ADMIN* can change status.
* `DELETE /:id`: Delete task (*ADMIN/MANAGER* only).

---

## Enforced Status Transitions

The application enforces a sequential workflow:
```
[TODO] ──> [IN_PROGRESS] ──> [IN_REVIEW] ──> [DONE]
  │               │              │
  ▼               ▼              ▼
[BLOCKED] <── (reachable from any active state)
  │
  ▼
(Can return to active states [TODO, IN_PROGRESS, IN_REVIEW])
```
* Status cannot jump states (e.g., `TODO` cannot jump directly to `DONE`).
* `BLOCKED` can be set from any active state.
* From `BLOCKED`, the status can return to any active state.
* `DONE` is a terminal state.
