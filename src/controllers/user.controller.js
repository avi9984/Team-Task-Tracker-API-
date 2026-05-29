import User from "../models/User.model.js";
import { AppError } from "../middlewares/error.middleware.js";

// Admin creates User within their organization
export const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(new AppError(400, "DUPLICATE_ERROR", "User with this email already exists"));
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || "MEMBER",
            organizationId: req.user.organizationId
        });

        res.status(201).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId
            }
        });
    } catch (error) {
        next(error);
    }
};

// Admin lists all users in their organization
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({ organizationId: req.user.organizationId })
            .select("-password -refreshToken");
        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

// Get User by ID (Admin only, scoped to org)
export const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select("-password -refreshToken");
        if (!user || user.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "User not found"));
        }
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

// Update User details / role (Admin only, scoped to org)
export const updateUser = async (req, res, next) => {
    try {
        const { name, role } = req.body;
        const user = await User.findById(req.params.id);
        if (!user || user.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "User not found"));
        }

        if (name) user.name = name;
        if (role) {
            if (!["ADMIN", "MANAGER", "MEMBER"].includes(role)) {
                return next(new AppError(400, "VALIDATION_ERROR", "role must be one of ADMIN, MANAGER, MEMBER"));
            }
            user.role = role;
        }

        await user.save();
        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId
            }
        });
    } catch (error) {
        next(error);
    }
};

// Delete user (Admin only, scoped to org)
export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "User not found"));
        }

        // Prevent self deletion
        if (user._id.toString() === req.user._id.toString()) {
            return next(new AppError(400, "VALIDATION_ERROR", "You cannot delete your own user account"));
        }

        await user.deleteOne();
        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
