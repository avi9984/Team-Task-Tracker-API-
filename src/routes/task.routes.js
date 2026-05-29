import { Router } from "express";
import { createTask, getTasks, getTaskById, updateTask, updateTaskStatus, deleteTask } from "../controllers/task.controller.js";
import { authenticate, authorizeRoles, authorizeTaskAccess, scopeTaskQueries } from "../middlewares/auth.middleware.js";
import { validateTaskCreate, validateTaskUpdate, validateTaskStatusUpdate } from "../middlewares/validation.middleware.js";

const router = Router();

// All task routes require authentication
router.use(authenticate);

// List tasks: available to all roles, but uses scopeTaskQueries for query filter scoping and caching
router.get("/", scopeTaskQueries, getTasks);

// Create task: ADMIN & MANAGER only
router.post("/", authorizeRoles("ADMIN", "MANAGER"), validateTaskCreate, createTask);

// Actions on a specific task: requires task access middleware (validates organization and assignee constraints)
router.get("/:id", authorizeTaskAccess, getTaskById);

// Update task details (title, priority, assignee, etc.): ADMIN & MANAGER only
router.patch("/:id", authorizeRoles("ADMIN", "MANAGER"), authorizeTaskAccess, validateTaskUpdate, updateTask);

// Update status (advance status): assignee or MANAGER or ADMIN
router.patch("/:id/status", authorizeTaskAccess, validateTaskStatusUpdate, updateTaskStatus);

// Delete task: ADMIN & MANAGER only
router.delete("/:id", authorizeRoles("ADMIN", "MANAGER"), authorizeTaskAccess, deleteTask);

export default router;
