import { Router } from "express";
import { createUser, getUsers, getUserById, updateUser, deleteUser } from "../controllers/user.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// All user routes require authentication and are restricted to ADMIN only
router.use(authenticate, authorizeRoles("ADMIN"));

router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
