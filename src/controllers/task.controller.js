import mongoose from "mongoose";
import Task from "../models/Task.model.js";
import User from "../models/User.model.js";
import Project from "../models/Project.model.js";
import redis from "../config/redis.js";
import { AppError } from "../middlewares/error.middleware.js";

// Helper to clear task lists cache for a specific assignee
export const clearAssigneeCache = async (assigneeId) => {
    if (!assigneeId) return;
    try {
        const pattern = `tasks:assignee:${assigneeId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
        }
    } catch (error) {
        console.error("Redis Cache Invalidation Error:", error.message);
    }
};

// Check if a transition is valid
const isValidTransition = (currentStatus, newStatus) => {
    if (currentStatus === newStatus) return true;
    if (newStatus === "BLOCKED") {
        // BLOCKED is reachable from any active state (TODO, IN_PROGRESS, IN_REVIEW)
        return ["TODO", "IN_PROGRESS", "IN_REVIEW"].includes(currentStatus);
    }

    const transitions = {
        "TODO": ["IN_PROGRESS"],
        "IN_PROGRESS": ["IN_REVIEW"],
        "IN_REVIEW": ["DONE"],
        "BLOCKED": ["TODO", "IN_PROGRESS", "IN_REVIEW"],
        "DONE": [] // DONE is a terminal state
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
};

// Create Task (ADMIN, MANAGER only)
export const createTask = async (req, res, next) => {
    try {
        const { title, description, priority, due_date, assignee, projectId } = req.body;
        const organizationId = req.user.organizationId;

        // Verify assignee belongs to the same organization
        if (assignee) {
            const user = await User.findById(assignee);
            if (!user || user.organizationId.toString() !== organizationId.toString()) {
                return next(new AppError(400, "VALIDATION_ERROR", "Assignee must be a member of your organization"));
            }
        }

        // Verify project belongs to the same organization
        if (projectId) {
            const project = await Project.findById(projectId);
            if (!project || project.organizationId.toString() !== organizationId.toString()) {
                return next(new AppError(400, "VALIDATION_ERROR", "Project must belong to your organization"));
            }
        }

        const task = await Task.create({
            title,
            description,
            priority: priority || "MEDIUM",
            status: "TODO",
            assignee,
            due_date,
            projectId,
            organizationId
        });

        // Invalidate assignee cache
        if (assignee) {
            await clearAssigneeCache(assignee);
        }

        res.status(201).json({
            success: true,
            data: task
        });
    } catch (error) {
        next(error);
    }
};

// List Tasks (all roles, scoped by middleware filtering)
export const getTasks = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, priority, assignee } = req.query;

        // Validate query parameters
        if (page) {
            const pageNum = Number(page);
            if (!Number.isInteger(pageNum) || pageNum < 1) {
                return next(new AppError(400, "VALIDATION_ERROR", "page must be a positive integer"));
            }
        }
        if (limit) {
            const limitNum = Number(limit);
            if (!Number.isInteger(limitNum) || limitNum < 1) {
                return next(new AppError(400, "VALIDATION_ERROR", "limit must be a positive integer"));
            }
        }
        if (status && !["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"].includes(status)) {
            return next(new AppError(400, "VALIDATION_ERROR", "status filter must be one of TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED"));
        }
        if (priority && !["LOW", "MEDIUM", "HIGH"].includes(priority)) {
            return next(new AppError(400, "VALIDATION_ERROR", "priority filter must be one of LOW, MEDIUM, HIGH"));
        }
        if (assignee && !mongoose.Types.ObjectId.isValid(assignee)) {
            return next(new AppError(400, "VALIDATION_ERROR", "assignee filter must be a valid ObjectId"));
        }

        const orgId = req.user.organizationId;

        // Base filter injected by scopeTaskQueries middleware
        const filter = { ...req.taskQueryFilter };

        // Apply route query filters
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        // If query requests a specific assignee, check permission
        if (assignee) {
            if (req.user.role === "MEMBER" && req.user._id.toString() !== assignee.toString()) {
                return next(new AppError(403, "FORBIDDEN", "MEMBER can only query their own tasks"));
            }
            filter.assignee = assignee;
        }

        // Determine cache parameters: cache when filtered by a specific assignee
        // In the MEMBER case, it is implicitly filtered by assignee (themselves)
        const targetAssigneeId = filter.assignee;
        let cacheKey = null;
        let cachedData = null;

        if (targetAssigneeId) {
            cacheKey = `tasks:assignee:${targetAssigneeId}:org:${orgId}:page:${page}:limit:${limit}:status:${status || "any"}:priority:${priority || "any"}`;
            try {
                cachedData = await redis.get(cacheKey);
            } catch (err) {
                console.error("Redis Read Error:", err.message);
            }
        }

        if (cachedData) {
            return res.status(200).json({
                success: true,
                cached: true,
                ...JSON.parse(cachedData)
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const tasks = await Task.find(filter)
            .populate("assignee", "name email role")
            .populate("projectId", "name description")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalTasks = await Task.countDocuments(filter);

        const responsePayload = {
            data: tasks,
            pagination: {
                total: totalTasks,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(totalTasks / limitNum)
            }
        };

        // Cache in Redis if we are caching per assignee
        if (cacheKey) {
            try {
                await redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 3600); // 1 hr TTL
            } catch (err) {
                console.error("Redis Write Error:", err.message);
            }
        }

        res.status(200).json({
            success: true,
            cached: false,
            ...responsePayload
        });
    } catch (error) {
        next(error);
    }
};

// Get Single Task by ID
export const getTaskById = async (req, res, next) => {
    // Already queried and authorized by authorizeTaskAccess middleware
    res.status(200).json({
        success: true,
        data: req.task
    });
};

// Update Task Details (ADMIN, MANAGER only)
export const updateTask = async (req, res, next) => {
    try {
        const { title, description, priority, due_date, assignee, projectId } = req.body;
        const task = req.task; // loaded by authorizeTaskAccess
        const organizationId = req.user.organizationId;

        const oldAssignee = task.assignee ? task.assignee.toString() : null;

        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority) task.priority = priority;
        if (due_date) task.due_date = due_date;

        if (assignee !== undefined) {
            if (assignee) {
                const user = await User.findById(assignee);
                if (!user || user.organizationId.toString() !== organizationId.toString()) {
                    return next(new AppError(400, "VALIDATION_ERROR", "Assignee must be a member of your organization"));
                }
                task.assignee = assignee;
            } else {
                task.assignee = undefined;
            }
        }

        if (projectId !== undefined) {
            if (projectId) {
                const project = await Project.findById(projectId);
                if (!project || project.organizationId.toString() !== organizationId.toString()) {
                    return next(new AppError(400, "VALIDATION_ERROR", "Project must belong to your organization"));
                }
                task.projectId = projectId;
            } else {
                task.projectId = undefined;
            }
        }

        await task.save();

        // Invalidate old and new assignee caches
        if (oldAssignee) {
            await clearAssigneeCache(oldAssignee);
        }
        if (task.assignee && task.assignee.toString() !== oldAssignee) {
            await clearAssigneeCache(task.assignee.toString());
        }

        res.status(200).json({
            success: true,
            data: task
        });
    } catch (error) {
        next(error);
    }
};

// Advance Task Status (Assignee or MANAGER or ADMIN)
export const updateTaskStatus = async (req, res, next) => {
    try {
        const { status: newStatus } = req.body;
        const task = req.task; // loaded by authorizeTaskAccess

        // Check if transition is valid
        if (!isValidTransition(task.status, newStatus)) {
            return next(new AppError(400, "VALIDATION_ERROR", `Invalid status transition from ${task.status} to ${newStatus}`));
        }

        // Check permissions: only assignee or MANAGER/ADMIN
        const isManagerOrAdmin = ["MANAGER", "ADMIN"].includes(req.user.role);
        const isAssignee = task.assignee && task.assignee.toString() === req.user._id.toString();

        if (!isManagerOrAdmin && !isAssignee) {
            return next(new AppError(403, "FORBIDDEN", "Only the assignee, a MANAGER, or an ADMIN can advance this task's status"));
        }

        task.status = newStatus;
        if (newStatus === "DONE") {
            task.completedAt = new Date();
        } else {
            task.completedAt = undefined;
        }

        await task.save();

        // Invalidate assignee cache
        if (task.assignee) {
            await clearAssigneeCache(task.assignee.toString());
        }

        res.status(200).json({
            success: true,
            data: task
        });
    } catch (error) {
        next(error);
    }
};

// Delete Task (ADMIN, MANAGER only)
export const deleteTask = async (req, res, next) => {
    try {
        const task = req.task; // loaded by authorizeTaskAccess
        const assignee = task.assignee ? task.assignee.toString() : null;

        await task.deleteOne();

        // Invalidate assignee cache
        if (assignee) {
            await clearAssigneeCache(assignee);
        }

        res.status(200).json({
            success: true,
            message: "Task deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
