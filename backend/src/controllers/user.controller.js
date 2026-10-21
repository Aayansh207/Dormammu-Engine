const prisma = require("../config/db");

async function createUser(req, res) {
  try {
    const { email, name } = req.body;

    const user = await prisma.user.create({
      data: { email, name },
    });

    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("createUser failed:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { createUser };