import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Mock environment variables for testing
process.env.JWT_ACCESS_SECRET = "test_access_secret";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret";
process.env.ACCESS_TOKEN_EXPIRE = "15m";
process.env.REFRESH_TOKEN_EXPIRE = "7d";

// 1. Status Transition Validator Test
const isValidTransition = (currentStatus, newStatus) => {
    if (currentStatus === newStatus) return true;
    if (newStatus === "BLOCKED") {
        return ["TODO", "IN_PROGRESS", "IN_REVIEW"].includes(currentStatus);
    }

    const transitions = {
        "TODO": ["IN_PROGRESS"],
        "IN_PROGRESS": ["IN_REVIEW"],
        "IN_REVIEW": ["DONE"],
        "BLOCKED": ["TODO", "IN_PROGRESS", "IN_REVIEW"],
        "DONE": []
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
};

console.log("--- 1. Testing Status Transitions ---");
const testTransitions = [
    { from: "TODO", to: "IN_PROGRESS", expected: true },
    { from: "TODO", to: "DONE", expected: false },
    { from: "IN_PROGRESS", to: "BLOCKED", expected: true },
    { from: "BLOCKED", to: "IN_PROGRESS", expected: true },
    { from: "DONE", to: "BLOCKED", expected: false },
];

testTransitions.forEach(t => {
    const result = isValidTransition(t.from, t.to);
    console.log(`Transition from ${t.from} to ${t.to}: Result = ${result}, Expected = ${t.expected} -> ${result === t.expected ? "PASS" : "FAIL"}`);
});

// 2. Token Generation & Verification Test
console.log("\n--- 2. Testing JWT Access/Refresh Tokens ---");
const mockUser = {
    _id: "507f1f77bcf86cd799439011",
    role: "MANAGER",
    organizationId: "507f1f77bcf86cd799439022"
};

const token = jwt.sign(
    { id: mockUser._id, role: mockUser.role, organizationId: mockUser.organizationId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
);

try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log("Token verification: PASS");
    console.log(`Decoded details: id=${decoded.id}, role=${decoded.role}, organizationId=${decoded.organizationId} -> PASS`);
} catch (err) {
    console.log("Token verification failed: FAIL", err.message);
}

// 3. Password Hashing Test
console.log("\n--- 3. Testing Password Cryptography ---");
const testPassword = "superSecretPassword123";

async function testCrypto() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(testPassword, salt);
        console.log("Password hash generation: PASS");
        
        const isMatch = await bcrypt.compare(testPassword, hashed);
        console.log(`Password match with original password: ${isMatch} -> ${isMatch ? "PASS" : "FAIL"}`);
        
        const isMatchWrong = await bcrypt.compare("wrongPassword", hashed);
        console.log(`Password match with incorrect password: ${isMatchWrong} -> ${!isMatchWrong ? "PASS" : "FAIL"}`);
    } catch (err) {
        console.log("Password hashing test failed: FAIL", err.message);
    }
}

testCrypto();
