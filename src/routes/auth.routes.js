import { Router } from "express";
import { register, login, refreshTokens, logout } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRegister, validateLogin } from "../middlewares/validation.middleware.js";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/refresh", refreshTokens);
router.post("/logout", authenticate, logout);

export default router;
