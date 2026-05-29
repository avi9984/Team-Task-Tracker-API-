import { AppError } from "./error.middleware.js";
import mongoose from "mongoose";

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

export const validateRegister = (req, res, next) => {
    const { name, email, password, role, organizationName, organizationId } = req.body;
    
    if (!name || typeof name !== "string" || name.trim() === "") {
        return next(new AppError(400, "VALIDATION_ERROR", "name is required and must be a non-empty string"));
    }
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
        return next(new AppError(400, "VALIDATION_ERROR", "email is required and must be a valid email address"));
    }
    if (!password || typeof password !== "string" || password.length < 6) {
        return next(new AppError(400, "VALIDATION_ERROR", "Password must be atleast 6 characters long"));
    }
    if (role && !["ADMIN", "MANAGER", "MEMBER"].includes(role)) {
        return next(new AppError(400, "VALIDATION_ERROR", "role must be one of ADMIN, MANAGER, MEMBER"));
    }
    if (!organizationName && !organizationId) {
        return next(new AppError(400, "VALIDATION_ERROR", "Either organizationName or organizationId is required"));
    }
    if (organizationId && !isValidObjectId(organizationId)) {
        return next(new AppError(400, "VALIDATION_ERROR", "organizationId must be a valid ObjectId"));
    }
    next();
};

export const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !isValidEmail(email)) {
        return next(new AppError(400, "VALIDATION_ERROR", "email is required and must be a valid email address"));
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
        return next(new AppError(400, "VALIDATION_ERROR", "password is required"));
    }
    next();
};

export const validateTaskCreate = (req, res, next) => {
    const { title, priority, due_date, assignee, projectId } = req.body;
    
    if (!title || typeof title !== "string" || title.trim() === "") {
        return next(new AppError(400, "VALIDATION_ERROR", "title is required and must be a non-empty string"));
    }
    if (priority && !["LOW", "MEDIUM", "HIGH"].includes(priority)) {
        return next(new AppError(400, "VALIDATION_ERROR", "priority must be one of LOW, MEDIUM, HIGH"));
    }
    if (due_date) {
        const dateVal = new Date(due_date);
        if (isNaN(dateVal.getTime())) {
            return next(new AppError(400, "VALIDATION_ERROR", "due_date must be a valid date"));
        }
        if (dateVal.getTime() <= Date.now()) {
            return next(new AppError(400, "VALIDATION_ERROR", "due_date must be a future date"));
        }
    }
    if (assignee && !isValidObjectId(assignee)) {
        return next(new AppError(400, "VALIDATION_ERROR", "assignee must be a valid ObjectId"));
    }
    if (projectId && !isValidObjectId(projectId)) {
        return next(new AppError(400, "VALIDATION_ERROR", "projectId must be a valid ObjectId"));
    }
    next();
};

export const validateTaskUpdate = (req, res, next) => {
    const { priority, due_date, assignee, projectId } = req.body;
    
    if (priority && !["LOW", "MEDIUM", "HIGH"].includes(priority)) {
        return next(new AppError(400, "VALIDATION_ERROR", "priority must be one of LOW, MEDIUM, HIGH"));
    }
    if (due_date) {
        const dateVal = new Date(due_date);
        if (isNaN(dateVal.getTime())) {
            return next(new AppError(400, "VALIDATION_ERROR", "due_date must be a valid date"));
        }
        if (dateVal.getTime() <= Date.now()) {
            return next(new AppError(400, "VALIDATION_ERROR", "due_date must be a future date"));
        }
    }
    if (assignee && !isValidObjectId(assignee)) {
        return next(new AppError(400, "VALIDATION_ERROR", "assignee must be a valid ObjectId"));
    }
    if (projectId && !isValidObjectId(projectId)) {
        return next(new AppError(400, "VALIDATION_ERROR", "projectId must be a valid ObjectId"));
    }
    next();
};

export const validateTaskStatusUpdate = (req, res, next) => {
    const { status } = req.body;
    if (!status || !["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"].includes(status)) {
        return next(new AppError(400, "VALIDATION_ERROR", "status is required and must be one of TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED"));
    }
    next();
};

export const validateProjectCreate = (req, res, next) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
        return next(new AppError(400, "VALIDATION_ERROR", "name is required and must be a non-empty string"));
    }
    next();
};
