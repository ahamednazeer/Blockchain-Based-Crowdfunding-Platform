const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
    {
        walletAddress: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        nonce: {
            type: String,
            default: () => crypto.randomBytes(32).toString("hex"),
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Regenerate nonce after each successful login to prevent replay attacks.
 */
userSchema.methods.regenerateNonce = function () {
    this.nonce = crypto.randomBytes(32).toString("hex");
    return this.save();
};

module.exports = mongoose.model("User", userSchema);

