import Project from "../models/Project.model.js";
import { AppError } from "../middlewares/error.middleware.js";

// Create Project
export const createProject = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const project = await Project.create({
            name,
            description,
            organizationId: req.user.organizationId
        });
        res.status(201).json({
            success: true,
            data: project
        });
    } catch (error) {
        next(error);
    }
};

// Get all Projects in organization
export const getProjects = async (req, res, next) => {
    try {
        const projects = await Project.find({ organizationId: req.user.organizationId });
        res.status(200).json({
            success: true,
            data: projects
        });
    } catch (error) {
        next(error);
    }
};

// Get single Project by ID
export const getProjectById = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || project.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "Project not found"));
        }
        res.status(200).json({
            success: true,
            data: project
        });
    } catch (error) {
        next(error);
    }
};

// Update Project
export const updateProject = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project || project.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "Project not found"));
        }
        
        if (name) project.name = name;
        if (description !== undefined) project.description = description;
        
        await project.save();
        res.status(200).json({
            success: true,
            data: project
        });
    } catch (error) {
        next(error);
    }
};

// Delete Project
export const deleteProject = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || project.organizationId.toString() !== req.user.organizationId.toString()) {
            return next(new AppError(404, "NOT_FOUND", "Project not found"));
        }
        
        await project.deleteOne();
        res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
