import mongoose from "mongoose";

const ObjectId = mongoose.Schema.Types.ObjectId;

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    organizationId: { type: ObjectId, ref: "Organization", required: true },

}, { timestamps: true, versionKey: false });


export default mongoose.model("Project", projectSchema);