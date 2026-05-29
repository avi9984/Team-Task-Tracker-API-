import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Task from "../models/Task.model.js";
import { AppError } from "./error.middleware.js";

// Authenticate JWT token
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next(new AppError(401, "UNAUTHORIZED", "Authorization token required"));
        }

        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return next(new AppError(401, "TOKEN_EXPIRED", "Access token expired"));
            }
            return next(new AppError(401, "UNAUTHORIZED", "Invalid access token"));
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new AppError(401, "UNAUTHORIZED", "User not found"));
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

// Authorize roles
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
        }
        if (!roles.includes(req.user.role)) {
            return next(new AppError(403, "FORBIDDEN", "You do not have permission to access this resource"));
        }
        next();
    };
};

// Task access middleware: verifies task ownership / organization scope
export const authorizeTaskAccess = async (req, res, next) => {
    try {
        const taskId = req.params.id;
        if (!taskId) {
            return next(new AppError(400, "VALIDATION_ERROR", "Task ID parameter is required"));
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return next(new AppError(404, "NOT_FOUND", "Task not found"));
        }

        // Organization isolation: must belong to the user's organization
        if (task.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(403, "FORBIDDEN", "You do not have access to this task"));
        }

        // MEMBER specific restriction: can only view/update if they are the assignee
        if (req.user.role === "MEMBER") {
            if (!task.assignee || task.assignee.toString() !== req.user._id.toString()) {
                return next(new AppError(403, "FORBIDDEN", "MEMBER can only access tasks assigned to them"));
            }
        }

        // Attach task to request object so controllers don't need to query it again
        req.task = task;
        next();
    } catch (error) {
        next(error);
    }
};

// Enforce query filters based on organization and roles
export const scopeTaskQueries = (req, res, next) => {
    if (!req.user) {
        return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    }
    
    req.taskQueryFilter = { organizationId: req.user.organizationId };
    
    if (req.user.role === "MEMBER") {
        req.taskQueryFilter.assignee = req.user._id;
    }
    
    next();
};
