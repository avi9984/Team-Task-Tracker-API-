export class AppError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.message = message;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (err, req, res, next) => {
    // If it's a Mongoose validation error
    if (err.name === "ValidationError") {
        const message = Object.values(err.errors).map(e => e.message).join(", ");
        return res.status(400).json({
            status: 400,
            code: "VALIDATION_ERROR",
            message
        });
    }

    // If it's a Mongo duplicate key error (e.g. email already exists)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            status: 400,
            code: "DUPLICATE_ERROR",
            message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
        });
    }

    // Cast error (e.g. invalid MongoDB ObjectId)
    if (err.name === "CastError") {
        return res.status(400).json({
            status: 400,
            code: "INVALID_ID",
            message: `Invalid ID value for ${err.path}`
        });
    }

    // JsonWebTokenError
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            status: 401,
            code: "UNAUTHORIZED",
            message: "Invalid token"
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            status: 401,
            code: "TOKEN_EXPIRED",
            message: "Token has expired"
        });
    }

    // Custom AppError
    if (err instanceof AppError) {
        return res.status(err.status).json({
            status: err.status,
            code: err.code,
            message: err.message
        });
    }

    // Default server error
    console.error("Server Error:", err);
    return res.status(500).json({
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: err.message || "An unexpected error occurred on the server"
    });
};
