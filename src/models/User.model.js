import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ObjectId = mongoose.Schema.Types.ObjectId;

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minLength: [6, "Password must be atleast 6 characters long"] },
    role: { type: String, enum: ["ADMIN", "MANAGER", "MEMBER"], default: "MEMBER" },
    refreshToken: { type: String },
    organizationId: { type: ObjectId, ref: "Organization", required: true },

}, { timestamps: true, versionKey: false });

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);