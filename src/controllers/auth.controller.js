import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Organization from "../models/Organization.model.js";
import { AppError } from "../middlewares/error.middleware.js";

// Helper to generate access tokens
export const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role, organizationId: user.organizationId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" }
    );
};

// Helper to generate refresh tokens
export const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "7d" }
    );
};

// Register endpoint
export const register = async (req, res, next) => {
    try {
        const { name, email, password, role, organizationName, organizationId } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(new AppError(400, "DUPLICATE_ERROR", "User with this email already exists"));
        }

        let orgId = organizationId;
        let orgName = "";

        if (organizationName) {
            const newOrg = await Organization.create({ name: organizationName });
            orgId = newOrg._id;
            orgName = newOrg.name;
        } else {
            const org = await Organization.findById(organizationId);
            if (!org) {
                return next(new AppError(404, "NOT_FOUND", "Organization not found"));
            }
            orgName = org.name;
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || "MEMBER",
            organizationId: orgId
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await user.save();

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organization: {
                        id: orgId,
                        name: orgName
                    }
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Login endpoint
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return next(new AppError(401, "UNAUTHORIZED", "Invalid email or password"));
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return next(new AppError(401, "UNAUTHORIZED", "Invalid email or password"));
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await user.save();

        const org = await Organization.findById(user.organizationId);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organization: {
                        id: user.organizationId,
                        name: org ? org.name : ""
                    }
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Refresh Token Rotation endpoint
export const refreshTokens = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next(new AppError(400, "VALIDATION_ERROR", "Refresh token is required"));
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return next(new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token"));
        }

        const user = await User.findById(decoded.id);
        if (!user || user.refreshToken !== refreshToken) {
            // If the user exists but tokens mismatch, we assume potential token leakage
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
            return next(new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token"));
        }

        // Rotate tokens
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshToken = newRefreshToken;
        await user.save();

        res.status(200).json({
            success: true,
            data: {
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Logout endpoint
export const logout = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.refreshToken = null;
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        next(error);
    }
};
