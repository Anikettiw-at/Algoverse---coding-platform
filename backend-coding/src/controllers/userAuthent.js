const redisClient = require("../config/redis");
const User = require("../models/user");
const validate = require("../utils/validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Cookie Config (Local vs Production Dynamic Setup)
const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction, // Localhost par false rahega, deployment pe true
  sameSite: isProduction ? "none" : "lax", // Local testing ke liye 'lax'
};

const cookieOptions = {
  ...baseCookieOptions,
  maxAge: 60 * 60 * 1000,
};

// Sirf yahi fields client se accept karte hain (mass assignment se bachne ke liye)
const pickUserFields = (body) => {
  const { firstName, lastName, emailId, age, password } = body;
  const data = { firstName, emailId, password };
  if (lastName !== undefined) data.lastName = lastName;
  if (age !== undefined) data.age = age;
  return data;
};

const getRegisterError = (err) => {
  if (err.code === 11000) return "Email already registered";
  return err.message || "Registration failed";
};

// ================= REGISTER =================
const register = async (req, res) => {
  try {
    validate(req.body);

    const userData = pickUserFields(req.body);

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await User.create({
      ...userData,
      password: hashedPassword,
      role: "user"
    });

    const token = jwt.sign(
      { _id: user._id, emailId: user.emailId, role: "user" },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );

    const reply = {
      firstName: user.firstName,
      emailId: user.emailId,
      _id: user._id,
      role: user.role,
    };

    res.cookie("token", token, cookieOptions);

    // 🌟 Always return JSON
    return res.status(201).json({
      success: true,
      user: reply,
      message: "Registered Successfully",
    });

  } catch (err) {
    // 🌟 FIX: Plain string ki jagah JSON return karo (Redux Toolkit fix)
    return res.status(400).json({
      success: false,
      message: getRegisterError(err)
    });
  }
};

// ================= LOGIN =================
const login = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    // typeof check NoSQL injection ({"$ne": null}) se bachata hai
    if (typeof emailId !== "string" || typeof password !== "string" || !emailId || !password) {
      throw new Error("Invalid Credentials");
    }

    const user = await User.findOne({ emailId: emailId.toLowerCase().trim() });
    if (!user) {
      throw new Error("Invalid Credentials");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new Error("Invalid Credentials");
    }

    const reply = {
      firstName: user.firstName,
      emailId: user.emailId,
      _id: user._id,
      role: user.role,
    };

    const token = jwt.sign(
      { _id: user._id, emailId: user.emailId, role: user.role },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      user: reply,
      message: "Login Successfully",
    });

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || "Invalid Credentials"
    });
  }
};

// ================= LOGOUT =================
const logout = async (req, res) => {
  try {
    const { token } = req.cookies;
    if (token) {
      const payload = jwt.decode(token);
      if (payload && payload.exp) {
        await redisClient.set(`token:${token}`, "Blocked");
        await redisClient.expireAt(`token:${token}`, payload.exp);
      }
    }

    // clearCookie ke options set karte waqt wale options se match hone chahiye (maxAge ke bina)
    res.clearCookie("token", baseCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Logged Out Successfully"
    });

  } catch (err) {
    return res.status(503).json({
      success: false,
      message: err.message || "Logout failed"
    });
  }
};

// ================= ADMIN REGISTER =================
const adminRegister = async (req, res) => {
  try {
    validate(req.body);

    const userData = pickUserFields(req.body);
    const role = req.body.role === "user" ? "user" : "admin";

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await User.create({
      ...userData,
      password: hashedPassword,
      role
    });

    // Naye user ka cookie set NAHI karte — warna logged-in admin ka apna session replace ho jayega
    return res.status(201).json({
      success: true,
      user: { firstName: user.firstName, emailId: user.emailId, _id: user._id, role: user.role },
      message: "Admin Registered Successfully"
    });

  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.code === 11000 ? "Email already registered" : (err.message || "Admin Registration failed")
    });
  }
};

// ================= DELETE PROFILE =================
const deleteProfile = async (req, res) => {
  try {
    const userId = req.result._id;

    await User.findByIdAndDelete(userId);

    res.clearCookie("token", baseCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Deleted Successfully"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  adminRegister,
  deleteProfile,
};