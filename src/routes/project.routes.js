import { Router } from "express";
import { createProject, getProjects, getProjectById, updateProject, deleteProject } from "../controllers/project.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { validateProjectCreate } from "../middlewares/validation.middleware.js";

const router = Router();

// All project routes require authentication
router.use(authenticate);

// Write operations restricted to ADMIN & MANAGER
router.post("/", authorizeRoles("ADMIN", "MANAGER"), validateProjectCreate, createProject);
router.patch("/:id", authorizeRoles("ADMIN", "MANAGER"), updateProject);
router.delete("/:id", authorizeRoles("ADMIN", "MANAGER"), deleteProject);

// Read operations allowed for ADMIN, MANAGER, MEMBER (scoped to organizationId in controller)
router.get("/", getProjects);
router.get("/:id", getProjectById);

export default router;
