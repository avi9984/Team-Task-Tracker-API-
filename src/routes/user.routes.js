import { Router } from "express";
import { createUser, getUsers, getUserById, updateUser, deleteUser } from "../controllers/user.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// All user routes require authentication
// Only ADMIN can create users
router.post("/", authenticate, authorizeRoles("ADMIN"), createUser);
router.get("/", authenticate, getUsers);
router.get("/:id", authenticate, getUserById);
router.patch("/:id", authenticate, authorizeRoles("ADMIN", "MANAGER"), updateUser);
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), deleteUser);

export default router;
