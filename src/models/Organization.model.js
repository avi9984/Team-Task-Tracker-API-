import mongoose from "mongoose";


const organizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
}, { timestamps: true, versionKey: false });


export default mongoose.model("Organization", organizationSchema);
