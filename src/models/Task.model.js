import mongoose from "mongoose";

const ObjectId = mongoose.Schema.Types.ObjectId;

const taskSchema = new mongoose.Schema(
    {
        organizationId: { type: ObjectId, ref: "Organization", required: true },
        projectId: { type: ObjectId, ref: "Project" },
        title: { type: String, required: true },
        description: String,
        priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
        status: { type: String, enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"], default: "TODO" },
        assignee: { type: ObjectId, ref: "User" },
        due_date: Date,
        completedAt: Date
    },
    { timestamps: true, versionKey: false }
);

taskSchema.index({ status: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ due_date: 1 });

taskSchema.index({ assignee: 1, status: 1 });

export default mongoose.model("Task", taskSchema);